import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";
import { seedBoardIfEmpty } from "@/lib/board-seed";
import { setBoardUpdated } from "@/lib/board-meta";

type ResetPayload = {
  board_id?: number | string;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = (await request.json()) as ResetPayload;
    const boardId = Number(payload.board_id ?? 0);
    if (!Number.isFinite(boardId) || boardId < 1) {
      return NextResponse.json({ error: "board_id is required." }, { status: 400 });
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
    if (!adminUser?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (adminUser.is_admin !== 1) {
      const memberResult = await database.execute({
        sql: "SELECT role, status FROM board_members WHERE board_id = ? AND user_id = ?",
        args: [boardId, adminUser.id],
      });
      const memberRow = memberResult.rows[0] as Record<string, unknown> | undefined;
      const role = String(memberRow?.role ?? "");
      const status = String(memberRow?.status ?? "");
      if (status !== "active" || role !== "admin") {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const archivedAt = new Date().toISOString();
    await database.execute({
      sql: "INSERT INTO board_archives (board_id, archived_at) VALUES (?, ?)",
      args: [boardId, archivedAt],
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
      sql: "SELECT users.username, board_members.total_score FROM board_members JOIN users ON board_members.user_id = users.id WHERE board_members.board_id = ? AND board_members.total_score > 0",
      args: [boardId],
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
      { sql: "DELETE FROM board_word_tiles WHERE board_id = ?", args: [boardId] },
      { sql: "DELETE FROM board_tiles WHERE board_id = ?", args: [boardId] },
      { sql: "DELETE FROM board_words WHERE board_id = ?", args: [boardId] },
      { sql: "UPDATE board_members SET total_score = 0 WHERE board_id = ?", args: [boardId] },
    ]);

    await seedBoardIfEmpty(boardId);
    await setBoardUpdated(archivedAt, boardId);

    return NextResponse.json({ success: true, archive_id: archiveId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reset board.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to reset board." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
