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
      sql: `CREATE TABLE IF NOT EXISTS boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'public',
        created_by INTEGER
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS board_members (
        board_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'active',
        total_score INTEGER NOT NULL DEFAULT 0,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (board_id, user_id),
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS board_members_user_idx ON board_members (user_id, status)",
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS board_invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL,
        code TEXT NOT NULL UNIQUE,
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT,
        max_uses INTEGER NOT NULL DEFAULT 0,
        uses INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        scope TEXT NOT NULL DEFAULT 'admin',
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS user_letters (
        board_id INTEGER NOT NULL DEFAULT 1,
        user_id INTEGER NOT NULL,
        letter TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (board_id, user_id, letter),
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS wordle_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL DEFAULT 1,
        user_id INTEGER NOT NULL,
        wordle_day TEXT NOT NULL,
        answer TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE (board_id, user_id, wordle_day)
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
        board_id INTEGER NOT NULL DEFAULT 1,
        word TEXT NOT NULL,
        start_x INTEGER NOT NULL,
        start_y INTEGER NOT NULL,
        direction TEXT NOT NULL,
        placed_by INTEGER NOT NULL,
        placed_at TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (placed_by) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS board_tiles (
        board_id INTEGER NOT NULL DEFAULT 1,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        letter TEXT NOT NULL,
        word_id INTEGER NOT NULL,
        placed_by INTEGER NOT NULL,
        placed_at TEXT NOT NULL,
        PRIMARY KEY (board_id, x, y),
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (word_id) REFERENCES board_words(id),
        FOREIGN KEY (placed_by) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS board_word_tiles (
        board_id INTEGER NOT NULL DEFAULT 1,
        word_id INTEGER NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        PRIMARY KEY (board_id, word_id, x, y),
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (word_id) REFERENCES board_words(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS board_archives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL DEFAULT 1,
        archived_at TEXT NOT NULL,
        FOREIGN KEY (board_id) REFERENCES boards(id)
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
    {
      sql: `CREATE TABLE IF NOT EXISTS board_meta (
        board_id INTEGER NOT NULL DEFAULT 1,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (board_id, key),
        FOREIGN KEY (board_id) REFERENCES boards(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS gifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL DEFAULT 1,
        title TEXT NOT NULL,
        letters_json TEXT NOT NULL,
        available_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (board_id) REFERENCES boards(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS gift_claims (
        gift_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        claimed_at TEXT NOT NULL,
        PRIMARY KEY (gift_id, user_id),
        FOREIGN KEY (gift_id) REFERENCES gifts(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS letter_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL DEFAULT 1,
        user_id INTEGER NOT NULL,
        letter TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL,
        source_id TEXT,
        source_label TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS letter_ledger_user_idx ON letter_ledger (user_id, created_at)",
      args: [],
    },
  ]);

  const boardsResult = await database.execute({
    sql: "SELECT COUNT(*) as count FROM boards",
    args: [],
  });
  const boardsCount = Number(
    (boardsResult.rows[0] as Record<string, unknown> | undefined)?.count ?? 0,
  );
  if (boardsCount === 0) {
    await database.execute({
      sql: "INSERT INTO boards (name, created_at, visibility) VALUES (?, ?, ?)",
      args: ["Main Board", new Date().toISOString(), "public"],
    });
  }

  const boardColumns = await database.execute({
    sql: "PRAGMA table_info(boards)",
    args: [],
  });
  const boardColumnNames = new Set(
    boardColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
  );
  if (!boardColumnNames.has("visibility")) {
    await database.execute({
      sql: "ALTER TABLE boards ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'",
      args: [],
    });
  }
  if (!boardColumnNames.has("created_by")) {
    await database.execute({
      sql: "ALTER TABLE boards ADD COLUMN created_by INTEGER",
      args: [],
    });
  }

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

  const memberColumns = await database.execute({
    sql: "PRAGMA table_info(board_members)",
    args: [],
  });
  if (memberColumns.rows.length > 0) {
    const memberNames = new Set(
      memberColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
    );
    if (!memberNames.has("total_score")) {
      await database.execute({
        sql: "ALTER TABLE board_members ADD COLUMN total_score INTEGER NOT NULL DEFAULT 0",
        args: [],
      });
    }
    if (!memberNames.has("status")) {
      await database.execute({
        sql: "ALTER TABLE board_members ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
        args: [],
      });
    }
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

  if (!boardWordNames.has("board_id")) {
    await database.execute({
      sql: "ALTER TABLE board_words ADD COLUMN board_id INTEGER NOT NULL DEFAULT 1",
      args: [],
    });
  }

  const userLettersColumns = await database.execute({
    sql: "PRAGMA table_info(user_letters)",
    args: [],
  });
  const userLettersNames = new Set(
    userLettersColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
  );
  if (!userLettersNames.has("board_id")) {
    await database.execute({
      sql: `CREATE TABLE user_letters_v2 (
        board_id INTEGER NOT NULL DEFAULT 1,
        user_id INTEGER NOT NULL,
        letter TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (board_id, user_id, letter),
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    });
    await database.execute({
      sql: "INSERT INTO user_letters_v2 (board_id, user_id, letter, quantity, updated_at) SELECT 1, user_id, letter, quantity, updated_at FROM user_letters",
      args: [],
    });
    await database.execute({ sql: "DROP TABLE user_letters", args: [] });
    await database.execute({
      sql: "ALTER TABLE user_letters_v2 RENAME TO user_letters",
      args: [],
    });
  }

  const submissionsColumns = await database.execute({
    sql: "PRAGMA table_info(wordle_submissions)",
    args: [],
  });
  const submissionsNames = new Set(
    submissionsColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
  );
  if (!submissionsNames.has("board_id")) {
    await database.execute({
      sql: `CREATE TABLE wordle_submissions_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL DEFAULT 1,
        user_id INTEGER NOT NULL,
        wordle_day TEXT NOT NULL,
        answer TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE (board_id, user_id, wordle_day)
      )`,
      args: [],
    });
    await database.execute({
      sql: "INSERT INTO wordle_submissions_v2 (id, board_id, user_id, wordle_day, answer, score, created_at) SELECT id, 1, user_id, wordle_day, answer, score, created_at FROM wordle_submissions",
      args: [],
    });
    await database.execute({ sql: "DROP TABLE wordle_submissions", args: [] });
    await database.execute({
      sql: "ALTER TABLE wordle_submissions_v2 RENAME TO wordle_submissions",
      args: [],
    });
  }

  const boardTilesColumns = await database.execute({
    sql: "PRAGMA table_info(board_tiles)",
    args: [],
  });
  const boardTilesNames = new Set(
    boardTilesColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
  );
  if (!boardTilesNames.has("board_id")) {
    await database.execute({
      sql: `CREATE TABLE board_tiles_v2 (
        board_id INTEGER NOT NULL DEFAULT 1,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        letter TEXT NOT NULL,
        word_id INTEGER NOT NULL,
        placed_by INTEGER NOT NULL,
        placed_at TEXT NOT NULL,
        PRIMARY KEY (board_id, x, y),
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (word_id) REFERENCES board_words(id),
        FOREIGN KEY (placed_by) REFERENCES users(id)
      )`,
      args: [],
    });
    await database.execute({
      sql: "INSERT INTO board_tiles_v2 (board_id, x, y, letter, word_id, placed_by, placed_at) SELECT 1, x, y, letter, word_id, placed_by, placed_at FROM board_tiles",
      args: [],
    });
    await database.execute({ sql: "DROP TABLE board_tiles", args: [] });
    await database.execute({
      sql: "ALTER TABLE board_tiles_v2 RENAME TO board_tiles",
      args: [],
    });
  }

  const boardWordTilesColumns = await database.execute({
    sql: "PRAGMA table_info(board_word_tiles)",
    args: [],
  });
  const boardWordTilesNames = new Set(
    boardWordTilesColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
  );
  if (!boardWordTilesNames.has("board_id")) {
    await database.execute({
      sql: `CREATE TABLE board_word_tiles_v2 (
        board_id INTEGER NOT NULL DEFAULT 1,
        word_id INTEGER NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL,
        PRIMARY KEY (board_id, word_id, x, y),
        FOREIGN KEY (board_id) REFERENCES boards(id),
        FOREIGN KEY (word_id) REFERENCES board_words(id)
      )`,
      args: [],
    });
    await database.execute({
      sql: "INSERT INTO board_word_tiles_v2 (board_id, word_id, x, y) SELECT 1, word_id, x, y FROM board_word_tiles",
      args: [],
    });
    await database.execute({ sql: "DROP TABLE board_word_tiles", args: [] });
    await database.execute({
      sql: "ALTER TABLE board_word_tiles_v2 RENAME TO board_word_tiles",
      args: [],
    });
  }

  const boardMetaColumns = await database.execute({
    sql: "PRAGMA table_info(board_meta)",
    args: [],
  });
  const boardMetaNames = new Set(
    boardMetaColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
  );
  if (!boardMetaNames.has("board_id")) {
    await database.execute({
      sql: `CREATE TABLE board_meta_v2 (
        board_id INTEGER NOT NULL DEFAULT 1,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (board_id, key),
        FOREIGN KEY (board_id) REFERENCES boards(id)
      )`,
      args: [],
    });
    await database.execute({
      sql: "INSERT INTO board_meta_v2 (board_id, key, value) SELECT 1, key, value FROM board_meta",
      args: [],
    });
    await database.execute({ sql: "DROP TABLE board_meta", args: [] });
    await database.execute({
      sql: "ALTER TABLE board_meta_v2 RENAME TO board_meta",
      args: [],
    });
  }

  const boardArchivesColumns = await database.execute({
    sql: "PRAGMA table_info(board_archives)",
    args: [],
  });
  const boardArchivesNames = new Set(
    boardArchivesColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
  );
  if (!boardArchivesNames.has("board_id")) {
    await database.execute({
      sql: "ALTER TABLE board_archives ADD COLUMN board_id INTEGER NOT NULL DEFAULT 1",
      args: [],
    });
  }

  const giftsColumns = await database.execute({
    sql: "PRAGMA table_info(gifts)",
    args: [],
  });
  const giftsNames = new Set(
    giftsColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
  );
  if (!giftsNames.has("board_id")) {
    await database.execute({
      sql: "ALTER TABLE gifts ADD COLUMN board_id INTEGER NOT NULL DEFAULT 1",
      args: [],
    });
  }

  const inviteColumns = await database.execute({
    sql: "PRAGMA table_info(board_invites)",
    args: [],
  });
  if (inviteColumns.rows.length > 0) {
    const inviteNames = new Set(
      inviteColumns.rows.map((row) => String((row as Record<string, unknown>).name)),
    );
    if (!inviteNames.has("is_active")) {
      await database.execute({
        sql: "ALTER TABLE board_invites ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
        args: [],
      });
    }
    if (!inviteNames.has("scope")) {
      await database.execute({
        sql: "ALTER TABLE board_invites ADD COLUMN scope TEXT NOT NULL DEFAULT 'admin'",
        args: [],
      });
    }
  }

  await database.execute({
    sql: "INSERT INTO board_members (board_id, user_id, role, status, total_score, joined_at) SELECT 1, id, CASE WHEN is_admin = 1 THEN 'admin' ELSE 'member' END, 'active', total_score, created_at FROM users WHERE telegram_user_id != 'system' AND id NOT IN (SELECT user_id FROM board_members WHERE board_id = 1)",
    args: [],
  });
  await database.execute({
    sql: "DELETE FROM board_members WHERE user_id IN (SELECT id FROM users WHERE telegram_user_id = 'system')",
    args: [],
  });
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
