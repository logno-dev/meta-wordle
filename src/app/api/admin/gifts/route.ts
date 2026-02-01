import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

type GiftPayload = {
  title?: string;
  letters?: Record<string, number>;
  available_at?: string;
  expires_at?: string;
  board_id?: number | string;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = (await request.json()) as GiftPayload;
    const title = payload.title?.trim();
    const availableAt = payload.available_at?.trim();
    const expiresAt = payload.expires_at?.trim();
    const letters = payload.letters ?? {};
    const boardId = Number(payload.board_id ?? 1);

    if (!Number.isFinite(boardId) || boardId < 1) {
      return NextResponse.json({ error: "board_id is required." }, { status: 400 });
    }

    if (!title || !availableAt || !expiresAt) {
      return NextResponse.json(
        { error: "title, available_at, and expires_at are required." },
        { status: 400 },
      );
    }

    const availableDate = new Date(availableAt);
    const expiresDate = new Date(expiresAt);
    if (Number.isNaN(availableDate.valueOf()) || Number.isNaN(expiresDate.valueOf())) {
      return NextResponse.json(
        { error: "Invalid date format." },
        { status: 400 },
      );
    }

    if (expiresDate <= availableDate) {
      return NextResponse.json(
        { error: "expires_at must be after available_at." },
        { status: 400 },
      );
    }

    const entries = Object.entries(letters)
      .map(([letter, quantity]) => ({
        letter: letter.toLowerCase(),
        quantity: Math.max(0, Math.floor(quantity)),
      }))
      .filter((entry) => /^[a-z]$/.test(entry.letter) && entry.quantity > 0);

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "letters payload is required." },
        { status: 400 },
      );
    }

    await ensureSchema();
    const database = db();
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at, users.is_admin FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const adminUser = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );

    if (!adminUser?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (adminUser.is_admin !== 1) {
      const memberResult = await database.execute({
        sql: "SELECT role, status FROM board_members WHERE board_id = ? AND user_id = ?",
        args: [boardId, adminUser.id],
      });
      const memberRow = memberResult.rows[0] as Record<string, unknown> | undefined;
      const role = String(memberRow?.role ?? "");
      const status = String(memberRow?.status ?? "");
      if (status !== "active" || role !== "admin") {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const createdAt = new Date().toISOString();
    await database.execute({
      sql: "INSERT INTO gifts (board_id, title, letters_json, available_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        boardId,
        title,
        JSON.stringify(entries),
        availableDate.toISOString(),
        expiresDate.toISOString(),
        createdAt,
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create gift.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to create gift." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
