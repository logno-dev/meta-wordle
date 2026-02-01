import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? 20);
    const boardIdParam = Number(searchParams.get("board_id") ?? 1);
    const boardId = Number.isFinite(boardIdParam) ? Math.trunc(boardIdParam) : null;
    if (!boardId || boardId < 1) {
      return NextResponse.json({ error: "board_id is required." }, { status: 400 });
    }
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(100, limitParam))
      : 20;

    await ensureSchema();
    const database = db();

    const boardResult = await database.execute({
      sql: "SELECT visibility FROM boards WHERE id = ?",
      args: [boardId],
    });
    const boardRow = boardResult.rows[0] as Record<string, unknown> | undefined;
    if (!boardRow) {
      return NextResponse.json({ error: "Board not found." }, { status: 404 });
    }
    const visibility = String(boardRow.visibility ?? "public");
    if (visibility !== "public") {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get("session_token")?.value;
      if (!sessionToken) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      const sessionResult = await database.execute({
        sql: "SELECT users.id FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
        args: [sessionToken, new Date().toISOString()],
      });
      const userId = String(
        (sessionResult.rows[0] as Record<string, unknown> | undefined)?.id ?? "",
      );
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      const memberResult = await database.execute({
        sql: "SELECT status FROM board_members WHERE board_id = ? AND user_id = ?",
        args: [boardId, userId],
      });
      const status = String(
        (memberResult.rows[0] as Record<string, unknown> | undefined)?.status ?? "",
      );
      if (status !== "active") {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }
    const result = await database.execute({
      sql: "SELECT users.username, board_members.total_score FROM board_members JOIN users ON board_members.user_id = users.id WHERE board_members.board_id = ? AND board_members.status = 'active' AND board_members.total_score > 0 ORDER BY board_members.total_score DESC, users.username ASC LIMIT ?",
      args: [boardId, limit],
    });

    return NextResponse.json({
      players: result.rows,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load leaderboard.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to load leaderboard." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
