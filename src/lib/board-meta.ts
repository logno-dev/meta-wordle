import { db, ensureSchema } from "@/lib/db";

const BOARD_UPDATED_KEY = "last_board_update";

export const setBoardUpdated = async (value: string) => {
  await ensureSchema();
  const database = db();
  await database.execute({
    sql: "INSERT INTO board_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [BOARD_UPDATED_KEY, value],
  });
};

export const getBoardUpdated = async () => {
  await ensureSchema();
  const database = db();
  const result = await database.execute({
    sql: "SELECT value FROM board_meta WHERE key = ?",
    args: [BOARD_UPDATED_KEY],
  });
  const value = String(
    (result.rows[0] as Record<string, unknown> | undefined)?.value ?? "",
  );
  return value || null;
};
