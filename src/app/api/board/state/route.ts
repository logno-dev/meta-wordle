import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(200, limitParam))
      : 50;

    await ensureSchema();
    const database = db();

    const wordsResult = await database.execute({
      sql: "SELECT board_words.id, board_words.word, board_words.start_x, board_words.start_y, board_words.direction, board_words.placed_by, board_words.placed_at, board_words.score, users.username FROM board_words JOIN users ON board_words.placed_by = users.id ORDER BY board_words.id DESC LIMIT ?",
      args: [limit],
    });

    const tilesResult = await database.execute({
      sql: "SELECT board_tiles.x, board_tiles.y, board_tiles.letter, board_tiles.word_id, board_tiles.placed_by, board_tiles.placed_at, board_words.direction FROM board_tiles JOIN board_words ON board_tiles.word_id = board_words.id ORDER BY board_tiles.placed_at DESC LIMIT ?",
      args: [limit * 5],
    });

    return NextResponse.json({
      words: wordsResult.rows,
      tiles: tilesResult.rows,
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
