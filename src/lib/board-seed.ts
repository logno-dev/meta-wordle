import { db, ensureSchema, ensureSystemUser } from "@/lib/db";

const SEED_WORDS = [
  "lumen",
  "trace",
  "glyph",
  "atlas",
  "nexus",
  "spire",
  "vivid",
  "crane",
  "quill",
  "orbit",
];

export const seedBoardIfEmpty = async () => {
  await ensureSchema();
  const database = db();
  const countResult = await database.execute({
    sql: "SELECT COUNT(*) as count FROM board_tiles",
    args: [],
  });
  const existingCount = Number(
    (countResult.rows[0] as Record<string, unknown> | undefined)?.count ?? 0,
  );
  if (existingCount > 0) {
    return { seeded: false };
  }

  const systemUserId = await ensureSystemUser();
  if (!systemUserId) {
    throw new Error("Unable to create system user.");
  }

  const word = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
  const placedAt = new Date().toISOString();
  const startX = 0;
  const startY = 0;
  const direction = "horizontal";

  await database.execute({
    sql: "INSERT INTO board_words (word, start_x, start_y, direction, placed_by, placed_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [word, startX, startY, direction, systemUserId, placedAt],
  });
  const wordIdResult = await database.execute({
    sql: "SELECT last_insert_rowid() as id",
    args: [],
  });
  const wordId = Number(
    (wordIdResult.rows[0] as Record<string, unknown> | undefined)?.id ?? 0,
  );
  if (!wordId) {
    throw new Error("Unable to seed board.");
  }

  const tileStatements = word.split("").map((letter, index) => ({
    sql: "INSERT INTO board_tiles (x, y, letter, word_id, placed_by, placed_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [startX + index, startY, letter, wordId, systemUserId, placedAt],
  }));
  await database.batch(tileStatements);

  return { seeded: true, word };
};
