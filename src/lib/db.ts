import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export const db = () => {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error("Missing TURSO_DATABASE_URL");
    }
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }

  return client;
};

export const ensureSchema = async () => {
  const database = db();
  await database.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS telegram_link_tokens (
        token TEXT PRIMARY KEY,
        telegram_user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        used_at TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        telegram_user_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      )`,
      args: [],
    },
  ]);

  const tokenColumns = await database.execute({
    sql: "PRAGMA table_info(telegram_link_tokens)",
    args: [],
  });
  const columnNames = new Set(
    tokenColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
  );

  if (!columnNames.has("used_at")) {
    await database.execute({
      sql: "ALTER TABLE telegram_link_tokens ADD COLUMN used_at TEXT",
      args: [],
    });
  }

  if (!columnNames.has("updated_at")) {
    await database.execute({
      sql: "ALTER TABLE telegram_link_tokens ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
      args: [],
    });
  }
};
