import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";
import { setBoardUpdated } from "@/lib/board-meta";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await ensureSchema();
    const database = db();
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at, users.is_admin FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const adminUser = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );

    if (!adminUser?.id || adminUser.is_admin !== 1) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const archivedAt = new Date().toISOString();
    await database.execute({
      sql: "INSERT INTO board_archives (archived_at) VALUES (?)",
      args: [archivedAt],
    });
    const archiveResult = await database.execute({
      sql: "SELECT last_insert_rowid() as id",
      args: [],
    });
    const archiveId = Number(
      (archiveResult.rows[0] as Record<string, unknown> | undefined)?.id ?? 0,
    );

    if (!archiveId) {
      return NextResponse.json(
        { error: "Unable to archive board." },
        { status: 500 },
      );
    }

    const scoreRows = await database.execute({
      sql: "SELECT username, total_score FROM users WHERE total_score > 0",
      args: [],
    });
    const scoreStatements = scoreRows.rows.map((row) => ({
      sql: "INSERT INTO board_archive_scores (archive_id, username, total_score) VALUES (?, ?, ?)",
      args: [
        archiveId,
        String((row as Record<string, unknown>).username ?? ""),
        Number((row as Record<string, unknown>).total_score ?? 0),
      ],
    }));

    await database.batch([
      ...scoreStatements,
      { sql: "DELETE FROM board_word_tiles", args: [] },
      { sql: "DELETE FROM board_tiles", args: [] },
      { sql: "DELETE FROM board_words", args: [] },
      { sql: "UPDATE users SET total_score = 0", args: [] },
    ]);
    await setBoardUpdated(archivedAt);

    return NextResponse.json({ success: true, archive_id: archiveId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to archive board.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to archive board." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
