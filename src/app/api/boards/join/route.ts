import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

type JoinBoardPayload = {
  code?: string;
  board_id?: number | string;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = (await request.json()) as JoinBoardPayload;
    const code = payload.code?.trim().toUpperCase();
    const boardIdParam = Number(payload.board_id ?? 0);

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

    let boardId = 0;
    if (code) {
      const inviteResult = await database.execute({
        sql: "SELECT board_id, expires_at, max_uses, uses FROM board_invites WHERE code = ? AND is_active = 1",
        args: [code],
      });
      const inviteRow = inviteResult.rows[0] as Record<string, unknown> | undefined;
      if (!inviteRow) {
        return NextResponse.json({ error: "Invalid invite code." }, { status: 404 });
      }
      const expiresAt = inviteRow.expires_at ? String(inviteRow.expires_at) : null;
      const maxUses = Number(inviteRow.max_uses ?? 0);
      const uses = Number(inviteRow.uses ?? 0);
      if (expiresAt && new Date(expiresAt).toISOString() <= new Date().toISOString()) {
        return NextResponse.json({ error: "Invite code expired." }, { status: 400 });
      }
      if (maxUses > 0 && uses >= maxUses) {
        return NextResponse.json({ error: "Invite code maxed out." }, { status: 400 });
      }
      boardId = Number(inviteRow.board_id ?? 0);
      if (!Number.isFinite(boardId) || boardId < 1) {
        return NextResponse.json({ error: "Invalid invite code." }, { status: 400 });
      }
      await database.execute({
        sql: "UPDATE board_invites SET uses = uses + 1 WHERE code = ?",
        args: [code],
      });
    } else if (Number.isFinite(boardIdParam) && boardIdParam > 0) {
      boardId = Math.trunc(boardIdParam);
      const boardResult = await database.execute({
        sql: "SELECT visibility FROM boards WHERE id = ?",
        args: [boardId],
      });
      const boardRow = boardResult.rows[0] as Record<string, unknown> | undefined;
      if (!boardRow) {
        return NextResponse.json({ error: "Board not found." }, { status: 404 });
      }
      if (String(boardRow.visibility ?? "private") !== "public") {
        return NextResponse.json({ error: "Invite code required." }, { status: 400 });
      }
    } else {
      return NextResponse.json(
        { error: "Invite code or board_id is required." },
        { status: 400 },
      );
    }

    const joinedAt = new Date().toISOString();
    await database.execute({
      sql: "INSERT INTO board_members (board_id, user_id, role, status, total_score, joined_at) VALUES (?, ?, 'member', 'active', 0, ?) ON CONFLICT(board_id, user_id) DO UPDATE SET status = 'active'",
      args: [boardId, user.id, joinedAt],
    });

    return NextResponse.json({ success: true, board_id: boardId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to join board.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to join board." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
