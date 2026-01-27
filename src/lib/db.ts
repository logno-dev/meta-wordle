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
        created_at TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0,
        total_score INTEGER NOT NULL DEFAULT 0
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS user_letters (
        user_id INTEGER NOT NULL,
        letter TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, letter),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS wordle_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        wordle_day TEXT NOT NULL,
        answer TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE (user_id, wordle_day)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS board_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        start_x INTEGER NOT NULL,
        start_y INTEGER NOT NULL,
        direction TEXT NOT NULL,
        placed_by INTEGER NOT NULL,
        placed_at TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (placed_by) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS board_tiles (
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        letter TEXT NOT NULL,
        word_id INTEGER NOT NULL,
        placed_by INTEGER NOT NULL,
        placed_at TEXT NOT NULL,
        PRIMARY KEY (x, y),
        FOREIGN KEY (word_id) REFERENCES board_words(id),
        FOREIGN KEY (placed_by) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS board_archives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        archived_at TEXT NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS board_archive_scores (
        archive_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        total_score INTEGER NOT NULL,
        FOREIGN KEY (archive_id) REFERENCES board_archives(id)
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

  const userColumns = await database.execute({
    sql: "PRAGMA table_info(users)",
    args: [],
  });
  const userColumnNames = new Set(
    userColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
  );

  if (!userColumnNames.has("is_admin")) {
    await database.execute({
      sql: "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0",
      args: [],
    });
  }

  if (!userColumnNames.has("total_score")) {
    await database.execute({
      sql: "ALTER TABLE users ADD COLUMN total_score INTEGER NOT NULL DEFAULT 0",
      args: [],
    });
  }

  const boardWordColumns = await database.execute({
    sql: "PRAGMA table_info(board_words)",
    args: [],
  });
  const boardWordNames = new Set(
    boardWordColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
  );

  if (!boardWordNames.has("score")) {
    await database.execute({
      sql: "ALTER TABLE board_words ADD COLUMN score INTEGER NOT NULL DEFAULT 0",
      args: [],
    });
  }
};

export const ensureSystemUser = async () => {
  const database = db();
  const systemResult = await database.execute({
    sql: "SELECT id FROM users WHERE telegram_user_id = ?",
    args: ["system"],
  });
  const existingId = String(
    (systemResult.rows[0] as Record<string, unknown> | undefined)?.id ?? "",
  );
  if (existingId) {
    return existingId;
  }

  const createdAt = new Date().toISOString();
  await database.execute({
    sql: "INSERT INTO users (username, password_hash, telegram_user_id, created_at) VALUES (?, ?, ?, ?)",
    args: ["board_seed", "system", "system", createdAt],
  });
  const createdResult = await database.execute({
    sql: "SELECT id FROM users WHERE telegram_user_id = ?",
    args: ["system"],
  });
  return String(
    (createdResult.rows[0] as Record<string, unknown> | undefined)?.id ?? "",
  );
};
