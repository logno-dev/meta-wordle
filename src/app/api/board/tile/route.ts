import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const x = Number(searchParams.get("x"));
    const y = Number(searchParams.get("y"));
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return NextResponse.json({ error: "x and y are required." }, { status: 400 });
    }

    await ensureSchema();
    const database = db();
    const result = await database.execute({
      sql: "SELECT board_words.word, board_words.direction, users.username FROM board_word_tiles JOIN board_words ON board_word_tiles.word_id = board_words.id JOIN users ON board_words.placed_by = users.id WHERE board_word_tiles.board_id = 1 AND board_word_tiles.x = ? AND board_word_tiles.y = ?",
      args: [x, y],
    });

    if (result.rows.length === 0) {
      const fallback = await database.execute({
        sql: "SELECT board_words.word, board_words.direction, users.username FROM board_tiles JOIN board_words ON board_tiles.word_id = board_words.id JOIN users ON board_words.placed_by = users.id WHERE board_tiles.board_id = 1 AND board_tiles.x = ? AND board_tiles.y = ?",
        args: [x, y],
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
