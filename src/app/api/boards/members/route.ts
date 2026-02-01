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
    const boardIdParam = Number(searchParams.get("board_id") ?? 0);
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

    if (user.is_admin !== 1) {
      const memberResult = await database.execute({
        sql: "SELECT role, status FROM board_members WHERE board_id = ? AND user_id = ?",
        args: [boardId, user.id],
      });
      const memberRow = memberResult.rows[0] as Record<string, unknown> | undefined;
      const role = String(memberRow?.role ?? "");
      const status = String(memberRow?.status ?? "");
      if (status !== "active" || role !== "admin") {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const membersResult = await database.execute({
      sql: "SELECT users.id, users.username, board_members.role, board_members.status, board_members.total_score FROM board_members JOIN users ON board_members.user_id = users.id WHERE board_members.board_id = ? ORDER BY users.username ASC",
      args: [boardId],
    });

    return NextResponse.json({ members: membersResult.rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load members.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to load members." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
