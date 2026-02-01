import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";
import { seedBoardIfEmpty } from "@/lib/board-seed";

type CreateBoardPayload = {
  name?: string;
  visibility?: string;
};

const normalizeVisibility = (value?: string) =>
  value === "public" ? "public" : "private";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await ensureSchema();
    const database = db();
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const boardsResult = await database.execute({
      sql: "SELECT boards.id, boards.name, boards.visibility, board_members.role, board_members.total_score, (SELECT COUNT(*) FROM board_members bm2 WHERE bm2.board_id = boards.id AND bm2.status = 'active') as member_count FROM board_members JOIN boards ON board_members.board_id = boards.id WHERE board_members.user_id = ? AND board_members.status = 'active' ORDER BY boards.id DESC",
      args: [user.id],
    });

    return NextResponse.json({ boards: boardsResult.rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load boards.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to load boards." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = (await request.json()) as CreateBoardPayload;
    const name = payload.name?.trim();
    const visibility = normalizeVisibility(payload.visibility);
    if (!name || name.length < 2 || name.length > 64) {
      return NextResponse.json(
        { error: "Board name must be between 2 and 64 characters." },
        { status: 400 },
      );
    }

    await ensureSchema();
    const database = db();
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const createdAt = new Date().toISOString();
    await database.execute({
      sql: "INSERT INTO boards (name, created_at, visibility, created_by) VALUES (?, ?, ?, ?)",
      args: [name, createdAt, visibility, user.id],
    });
    const boardIdResult = await database.execute({
      sql: "SELECT last_insert_rowid() as id",
      args: [],
    });
    const boardId = Number(
      (boardIdResult.rows[0] as Record<string, unknown> | undefined)?.id ?? 0,
    );
    if (!boardId) {
      return NextResponse.json(
        { error: "Unable to create board." },
        { status: 500 },
      );
    }

    await database.execute({
      sql: "INSERT INTO board_members (board_id, user_id, role, status, total_score, joined_at) VALUES (?, ?, 'admin', 'active', 0, ?)",
      args: [boardId, user.id, createdAt],
    });

    await seedBoardIfEmpty(boardId);

    return NextResponse.json({ success: true, board_id: boardId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create board.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to create board." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
