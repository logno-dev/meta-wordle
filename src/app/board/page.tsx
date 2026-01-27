type BoardPageProps = {
  searchParams?: Promise<{
    username?: string | string[];
    telegram_user_id?: string | string[];
  }>;
};

const normalizeParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeLetterRow, normalizeUserRow } from "@/lib/db-utils";
import BoardScene from "./BoardScene";

type LetterEntry = {
  letter: string;
  quantity: number;
  updated_at: string | null;
};

type BoardTile = {
  x: number;
  y: number;
  letter: string;
  direction: "horizontal" | "vertical";
};

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const username = normalizeParam(resolvedParams?.username);
  const telegramUserId = normalizeParam(resolvedParams?.telegram_user_id);
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  await ensureSchema();
  const database = db();

  let user = null as ReturnType<typeof normalizeUserRow> | null;
  let letters: LetterEntry[] = [];
  let tiles: BoardTile[] = [];

  if (username || telegramUserId) {
    const lookupValue = telegramUserId ?? username;
    if (lookupValue) {
      const userResult = await database.execute({
        sql: telegramUserId
          ? "SELECT id, username, password_hash, telegram_user_id, created_at, total_score FROM users WHERE telegram_user_id = ?"
          : "SELECT id, username, password_hash, telegram_user_id, created_at, total_score FROM users WHERE username = ?",
        args: [lookupValue],
      });
      user = normalizeUserRow(
        userResult.rows[0] as Record<string, unknown> | undefined,
      );
    }
  } else if (sessionToken) {
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at, users.total_score FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );
  }

  if (user?.id) {
    const lettersResult = await database.execute({
      sql: "SELECT letter, quantity, updated_at FROM user_letters WHERE user_id = ? ORDER BY letter ASC",
      args: [user.id],
    });
    letters = lettersResult.rows
      .map((row) => normalizeLetterRow(row as Record<string, unknown>))
      .filter((entry): entry is LetterEntry => Boolean(entry));
  }

  const tilesResult = await database.execute({
    sql: "SELECT board_tiles.x, board_tiles.y, board_tiles.letter, board_words.direction FROM board_tiles JOIN board_words ON board_tiles.word_id = board_words.id",
    args: [],
  });
  tiles = tilesResult.rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      x: Number(record.x ?? 0),
      y: Number(record.y ?? 0),
      letter: String(record.letter ?? ""),
      direction:
        record.direction === "vertical" ? "vertical" : "horizontal",
    } as BoardTile;
  });

  return (
    <BoardScene
      tiles={tiles}
      letters={letters}
      loggedIn={Boolean(user?.id)}
      totalScore={user?.total_score ?? 0}
    />
  );
}
