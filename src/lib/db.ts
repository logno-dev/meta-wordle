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
        updated_at TEXT NOT NULL,
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
};
