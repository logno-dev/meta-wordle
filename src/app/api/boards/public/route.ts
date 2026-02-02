import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await ensureSchema();
    const database = db();
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const boardsResult = await database.execute({
      sql: "SELECT boards.id, boards.name, boards.visibility, (SELECT COUNT(*) FROM board_members bm2 WHERE bm2.board_id = boards.id AND bm2.status = 'active') as member_count FROM boards WHERE boards.visibility = 'public' AND boards.id NOT IN (SELECT board_id FROM board_members WHERE user_id = ? AND status = 'active') ORDER BY boards.id DESC",
      args: [user.id],
    });

    return NextResponse.json({ boards: boardsResult.rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load public boards.";
    const safeMessage =
      process.env.NODE_ENV === "production"
        ? "Unable to load public boards."
        : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
