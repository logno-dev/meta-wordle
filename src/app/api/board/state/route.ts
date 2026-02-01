import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? 50);
    const boardIdParam = Number(searchParams.get("board_id") ?? 1);
    const boardId = Number.isFinite(boardIdParam) ? Math.trunc(boardIdParam) : null;
    if (!boardId || boardId < 1) {
      return NextResponse.json({ error: "board_id is required." }, { status: 400 });
    }
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(200, limitParam))
      : 50;

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

    const wordsResult = await database.execute({
      sql: "SELECT board_words.id, board_words.word, board_words.start_x, board_words.start_y, board_words.direction, board_words.placed_by, board_words.placed_at, board_words.score, users.username FROM board_words JOIN users ON board_words.placed_by = users.id WHERE board_words.board_id = ? ORDER BY board_words.id DESC LIMIT ?",
      args: [boardId, limit],
    });

    const tilesResult = await database.execute({
      sql: "SELECT board_tiles.x, board_tiles.y, board_tiles.letter, board_tiles.word_id, board_tiles.placed_by, board_tiles.placed_at, board_words.direction FROM board_tiles JOIN board_words ON board_tiles.word_id = board_words.id WHERE board_tiles.board_id = ? ORDER BY board_tiles.placed_at DESC LIMIT ?",
      args: [boardId, limit * 5],
    });

    const latestResult = await database.execute({
      sql: "SELECT id FROM board_words WHERE board_id = ? ORDER BY id DESC LIMIT 1",
      args: [boardId],
    });
    const latestWordId = Number(
      (latestResult.rows[0] as Record<string, unknown> | undefined)?.id ?? 0,
    );

    return NextResponse.json({
      words: wordsResult.rows,
      tiles: tilesResult.rows,
      latest_word_id: latestWordId || null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load board state.";
    const safeMessage =
      process.env.NODE_ENV === "production"
        ? "Unable to load board state."
        : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
