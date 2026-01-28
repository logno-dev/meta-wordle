import { db, ensureSchema } from "@/lib/db";

const BOARD_UPDATED_KEY = "last_board_update";
const DEFAULT_BOARD_ID = 1;

export const setBoardUpdated = async (value: string, boardId = DEFAULT_BOARD_ID) => {
  await ensureSchema();
  const database = db();
  await database.execute({
    sql: "INSERT INTO board_meta (board_id, key, value) VALUES (?, ?, ?) ON CONFLICT(board_id, key) DO UPDATE SET value = excluded.value",
    args: [boardId, BOARD_UPDATED_KEY, value],
  });
};

export const getBoardUpdated = async (boardId = DEFAULT_BOARD_ID) => {
  await ensureSchema();
  const database = db();
  const result = await database.execute({
    sql: "SELECT value FROM board_meta WHERE board_id = ? AND key = ?",
    args: [boardId, BOARD_UPDATED_KEY],
  });
  const value = String(
    (result.rows[0] as Record<string, unknown> | undefined)?.value ?? "",
  );
  return value || null;
};
