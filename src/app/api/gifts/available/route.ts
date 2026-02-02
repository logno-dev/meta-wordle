import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const boardIdParam = Number(searchParams.get("board_id") ?? 1);
    const boardId = Number.isFinite(boardIdParam) ? Math.trunc(boardIdParam) : null;
    if (!boardId || boardId < 1) {
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
    const giftsResult = await database.execute({
      sql: "SELECT id, title, letters_json, available_at, expires_at FROM gifts WHERE board_id = ? AND available_at <= ? AND expires_at > ? AND id NOT IN (SELECT gift_id FROM gift_claims WHERE board_id = ? AND user_id = ?)",
      args: [boardId, now, now, boardId, user.id],
    });

    return NextResponse.json({ gifts: giftsResult.rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load gifts.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to load gifts." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
