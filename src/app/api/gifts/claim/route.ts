import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

type ClaimPayload = {
  gift_id?: number | string;
  board_id?: number | string;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = (await request.json()) as ClaimPayload;
    const giftId = Number(payload.gift_id);
    const boardId = Number(payload.board_id ?? 0);
    if (!Number.isFinite(giftId)) {
      return NextResponse.json({ error: "gift_id is required." }, { status: 400 });
    }
    if (!Number.isFinite(boardId) || boardId < 1) {
      return NextResponse.json({ error: "board_id is required." }, { status: 400 });
    }

    await ensureSchema();
    const database = db();
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at, users.is_admin FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const memberResult = await database.execute({
      sql: "SELECT status FROM board_members WHERE board_id = ? AND user_id = ?",
      args: [boardId, user.id],
    });
    const memberStatus = String(
      (memberResult.rows[0] as Record<string, unknown> | undefined)?.status ?? "",
    );
    if (memberStatus !== "active") {
      return NextResponse.json({ error: "Not a board member." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const giftResult = await database.execute({
      sql: "SELECT id, title, letters_json, available_at, expires_at FROM gifts WHERE id = ? AND board_id = ?",
      args: [giftId, boardId],
    });
    const giftRow = giftResult.rows[0] as Record<string, unknown> | undefined;
    if (!giftRow) {
      return NextResponse.json({ error: "Gift not found." }, { status: 404 });
    }

    if (
      new Date(String(giftRow.available_at)).toISOString() > now ||
      new Date(String(giftRow.expires_at)).toISOString() <= now
    ) {
      return NextResponse.json(
        { error: "Gift not available." },
        { status: 400 },
      );
    }

    const claimResult = await database.execute({
      sql: "SELECT gift_id FROM gift_claims WHERE gift_id = ? AND user_id = ?",
      args: [giftId, user.id],
    });
    if (claimResult.rows.length > 0) {
      return NextResponse.json(
        { error: "Gift already claimed." },
        { status: 409 },
      );
    }

    let letters: Array<{ letter: string; quantity: number }> = [];
    try {
      letters = JSON.parse(String(giftRow.letters_json));
    } catch (error) {
      return NextResponse.json(
        { error: "Gift is invalid." },
        { status: 500 },
      );
    }

    const updatedAt = new Date().toISOString();
    const giftTitle = String(giftRow.title ?? "Gift");
    const statements = letters.flatMap((entry) => [
      {
        sql: "INSERT INTO user_letters (board_id, user_id, letter, quantity, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(board_id, user_id, letter) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = excluded.updated_at",
        args: [boardId, user.id, entry.letter, entry.quantity, updatedAt],
      },
      {
        sql: "INSERT INTO letter_ledger (board_id, user_id, letter, quantity, source, source_id, source_label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [boardId, user.id, entry.letter, entry.quantity, "gift", String(giftId), giftTitle, updatedAt],
      },
    ]);
    await database.batch([
      { sql: "INSERT INTO gift_claims (gift_id, user_id, claimed_at) VALUES (?, ?, ?)", args: [giftId, user.id, updatedAt] },
      ...statements,
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to claim gift.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to claim gift." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
