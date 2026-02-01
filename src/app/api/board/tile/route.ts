import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const boardIdParam = Number(searchParams.get("board_id") ?? 1);
    const boardId = Number.isFinite(boardIdParam) ? Math.trunc(boardIdParam) : null;
    const x = Number(searchParams.get("x"));
    const y = Number(searchParams.get("y"));
    if (!boardId || boardId < 1 || !Number.isFinite(x) || !Number.isFinite(y)) {
      return NextResponse.json({ error: "x and y are required." }, { status: 400 });
    }

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
      sql: "SELECT board_words.word, board_words.direction, users.username FROM board_word_tiles JOIN board_words ON board_word_tiles.word_id = board_words.id JOIN users ON board_words.placed_by = users.id WHERE board_word_tiles.board_id = ? AND board_word_tiles.x = ? AND board_word_tiles.y = ?",
      args: [boardId, x, y],
    });

    if (result.rows.length === 0) {
      const fallback = await database.execute({
        sql: "SELECT board_words.word, board_words.direction, users.username FROM board_tiles JOIN board_words ON board_tiles.word_id = board_words.id JOIN users ON board_words.placed_by = users.id WHERE board_tiles.board_id = ? AND board_tiles.x = ? AND board_tiles.y = ?",
        args: [boardId, x, y],
      });
      return NextResponse.json({ entries: fallback.rows });
    }

    return NextResponse.json({ entries: result.rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load tile info.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to load tile info." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
