import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { isValidWord } from "@/lib/dictionary";
import { SCRABBLE_SCORES, pickRewardLetters } from "@/lib/letters";
import { setBoardUpdated } from "@/lib/board-meta";

type PlacePayload = {
  word?: string;
  anchor_x?: number | string;
  anchor_y?: number | string;
  anchor_index?: number | string;
  direction?: "horizontal" | "vertical" | string;
};

type Tile = {
  x: number;
  y: number;
  letter: string;
};

const parseCoordinate = (value: number | string | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
};

const normalizeWord = (value?: string) => {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed || !/^[a-z]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
};

const createPositions = (
  word: string,
  startX: number,
  startY: number,
  direction: "horizontal" | "vertical",
): Tile[] => {
  return word.split("").map((letter, index) => ({
    letter,
    x: direction === "horizontal" ? startX + index : startX,
    y: direction === "vertical" ? startY + index : startY,
  }));
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = (await request.json()) as PlacePayload;
    const word = normalizeWord(payload.word);
    const anchorX = parseCoordinate(payload.anchor_x);
    const anchorY = parseCoordinate(payload.anchor_y);
    const anchorIndex = parseCoordinate(payload.anchor_index);
    const direction = payload.direction === "vertical" ? "vertical" : "horizontal";

    if (!word || anchorX === null || anchorY === null || anchorIndex === null) {
      return NextResponse.json(
        { error: "word, anchor_x, anchor_y, and anchor_index are required." },
        { status: 400 },
      );
    }

    if (anchorIndex < 0 || anchorIndex >= word.length) {
      return NextResponse.json(
        { error: "anchor_index is out of range." },
        { status: 400 },
      );
    }

    const wordValid = await isValidWord(word);
    if (!wordValid) {
      return NextResponse.json({ error: "Not a valid word." }, { status: 400 });
    }

    const startX = direction === "horizontal" ? anchorX - anchorIndex : anchorX;
    const startY = direction === "vertical" ? anchorY - anchorIndex : anchorY;

    const positions = createPositions(word, startX, startY, direction);
    const minX = Math.min(...positions.map((pos) => pos.x));
    const maxX = Math.max(...positions.map((pos) => pos.x));
    const minY = Math.min(...positions.map((pos) => pos.y));
    const maxY = Math.max(...positions.map((pos) => pos.y));

    await ensureSchema();
    const database = db();

    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.telegram_user_id FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const userRow = sessionResult.rows[0] as Record<string, unknown> | undefined;
    const userId = userRow ? String(userRow.id ?? "") : "";
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const existingCountResult = await database.execute({
      sql: "SELECT COUNT(*) as count FROM board_tiles WHERE board_id = 1",
      args: [],
    });
    const existingCount = Number(
      (existingCountResult.rows[0] as Record<string, unknown> | undefined)?.count ?? 0,
    );

    const neighborResult = await database.execute({
      sql: "SELECT board_tiles.x, board_tiles.y, board_tiles.letter, board_words.direction FROM board_tiles JOIN board_words ON board_tiles.word_id = board_words.id WHERE board_tiles.board_id = 1 AND board_tiles.x BETWEEN ? AND ? AND board_tiles.y BETWEEN ? AND ?",
      args: [minX - 1, maxX + 1, minY - 1, maxY + 1],
    });
    const neighborTiles = neighborResult.rows.map((row) => ({
      x: Number((row as Record<string, unknown>).x),
      y: Number((row as Record<string, unknown>).y),
      letter: String((row as Record<string, unknown>).letter ?? ""),
      direction:
        (row as Record<string, unknown>).direction === "vertical"
          ? "vertical"
          : "horizontal",
    }));
    const tileMap = new Map(
      neighborTiles.map((tile) => [`${tile.x},${tile.y}`, tile]),
    );

    const anchorTile = tileMap.get(`${anchorX},${anchorY}`);
    if (!anchorTile) {
      return NextResponse.json(
        { error: "Anchor tile not found." },
        { status: 400 },
      );
    }
    if (anchorTile.letter !== word[anchorIndex]) {
      return NextResponse.json(
        { error: "Anchor letter does not match word." },
        { status: 400 },
      );
    }

    let hasOverlap = false;
    let hasAdjacent = false;
    const newTiles: Tile[] = [];
    const letterCounts = new Map<string, number>();

    for (const pos of positions) {
      const key = `${pos.x},${pos.y}`;
      const existing = tileMap.get(key);

      if (existing) {
        if (existing.letter !== pos.letter) {
          return NextResponse.json(
            { error: `Tile conflict at (${pos.x}, ${pos.y}).` },
            { status: 409 },
          );
        }
        hasOverlap = true;
        continue;
      }

      newTiles.push(pos);
      letterCounts.set(pos.letter, (letterCounts.get(pos.letter) ?? 0) + 1);

      const neighbors = [
        `${pos.x + 1},${pos.y}`,
        `${pos.x - 1},${pos.y}`,
        `${pos.x},${pos.y + 1}`,
        `${pos.x},${pos.y - 1}`,
      ];
      if (neighbors.some((neighbor) => tileMap.has(neighbor))) {
        hasAdjacent = true;
      }
    }

    if (newTiles.length === 0) {
      return NextResponse.json(
        { error: "Word must place at least one new tile." },
        { status: 400 },
      );
    }

    if (existingCount > 0 && !hasOverlap && !hasAdjacent) {
      return NextResponse.json(
        { error: "Word must connect to existing tiles." },
        { status: 400 },
      );
    }

    const lettersNeeded = Array.from(letterCounts.keys());
    const placeholders = lettersNeeded.map(() => "?").join(",");
    const inventoryResult = lettersNeeded.length
      ? await database.execute({
          sql: `SELECT letter, quantity FROM user_letters WHERE board_id = 1 AND user_id = ? AND letter IN (${placeholders})`,
          args: [userId, ...lettersNeeded],
        })
      : { rows: [] };

    const inventoryMap = new Map(
      inventoryResult.rows.map((row) => [
        String((row as Record<string, unknown>).letter ?? ""),
        Number((row as Record<string, unknown>).quantity ?? 0),
      ]),
    );

    for (const [letter, needed] of letterCounts.entries()) {
      const available = inventoryMap.get(letter) ?? 0;
      if (available < needed) {
        return NextResponse.json(
          { error: `Not enough '${letter.toUpperCase()}' tiles.` },
          { status: 400 },
        );
      }
    }

    const placedAt = new Date().toISOString();
    const score = calculateScore(word);
    const rewardCount = score >= 18 ? 5 : score >= 10 ? 3 : 1;
    const rewardLetters = rewardCount > 0 ? pickRewardLetters(rewardCount) : [];
    await database.execute({
      sql: "INSERT INTO board_words (board_id, word, start_x, start_y, direction, placed_by, placed_at, score) VALUES (1, ?, ?, ?, ?, ?, ?, ?)",
      args: [word, startX, startY, direction, userId, placedAt, score],
    });

    const wordIdResult = await database.execute({
      sql: "SELECT last_insert_rowid() as id",
      args: [],
    });
    const wordId = Number(
      (wordIdResult.rows[0] as Record<string, unknown> | undefined)?.id ?? 0,
    );
    if (!wordId) {
      return NextResponse.json(
        { error: "Unable to place word." },
        { status: 500 },
      );
    }

    const statements = newTiles.map((tile) => ({
      sql: "INSERT INTO board_tiles (board_id, x, y, letter, word_id, placed_by, placed_at) VALUES (1, ?, ?, ?, ?, ?, ?)",
      args: [tile.x, tile.y, tile.letter, wordId, userId, placedAt],
    }));

    for (const pos of positions) {
      statements.push({
        sql: "INSERT INTO board_word_tiles (board_id, word_id, x, y) VALUES (1, ?, ?, ?)",
        args: [wordId, pos.x, pos.y],
      });
    }

    for (const [letter, count] of letterCounts.entries()) {
      statements.push({
        sql: "UPDATE user_letters SET quantity = quantity - ?, updated_at = ? WHERE board_id = 1 AND user_id = ? AND letter = ?",
        args: [count, placedAt, userId, letter],
      });
    }

    for (const letter of rewardLetters) {
      statements.push({
        sql: "INSERT INTO user_letters (board_id, user_id, letter, quantity, updated_at) VALUES (1, ?, ?, 1, ?) ON CONFLICT(board_id, user_id, letter) DO UPDATE SET quantity = quantity + 1, updated_at = excluded.updated_at",
        args: [userId, letter, placedAt],
      });
    }

    statements.push({
      sql: "UPDATE users SET total_score = total_score + ? WHERE id = ?",
      args: [score, userId],
    });

    await database.batch(statements);
    await setBoardUpdated(placedAt);

    return NextResponse.json({
      success: true,
      word_id: wordId,
      placed_tiles: newTiles.length,
      score,
      reward_letters: rewardLetters,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to place word.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to place word." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
const calculateScore = (word: string) => {
  return word
    .split("")
    .reduce((sum, letter) => sum + (SCRABBLE_SCORES[letter] ?? 1), 0);
};
