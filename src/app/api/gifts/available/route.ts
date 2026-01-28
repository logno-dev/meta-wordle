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

    const now = new Date().toISOString();
    const giftsResult = await database.execute({
      sql: "SELECT id, title, letters_json, available_at, expires_at FROM gifts WHERE board_id = 1 AND available_at <= ? AND expires_at > ? AND id NOT IN (SELECT gift_id FROM gift_claims WHERE user_id = ?)",
      args: [now, now, user.id],
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
