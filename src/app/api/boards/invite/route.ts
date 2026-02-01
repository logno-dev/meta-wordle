import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

type InvitePayload = {
  board_id?: number | string;
  expires_at?: string;
  max_uses?: number | string;
  scope?: string;
};

const createCode = () => randomBytes(4).toString("hex").toUpperCase();
const normalizeScope = (value?: string) => (value === "member" ? "member" : "admin");

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const boardId = Number(searchParams.get("board_id") ?? 0);
    if (!Number.isFinite(boardId) || boardId < 1) {
      return NextResponse.json({ error: "board_id is required." }, { status: 400 });
    }

    await ensureSchema();
    const database = db();
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at, users.is_admin FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const memberResult = await database.execute({
      sql: "SELECT role, status FROM board_members WHERE board_id = ? AND user_id = ?",
      args: [boardId, user.id],
    });
    const memberRow = memberResult.rows[0] as Record<string, unknown> | undefined;
    const role = String(memberRow?.role ?? "");
    const status = String(memberRow?.status ?? "");
    if (status !== "active") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const inviteResult = await database.execute({
      sql: "SELECT id, code, scope, expires_at, max_uses, uses FROM board_invites WHERE board_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1",
      args: [boardId],
    });
    const inviteRow = inviteResult.rows[0] as Record<string, unknown> | undefined;
    if (!inviteRow) {
      return NextResponse.json({ invite: null });
    }

    const expiresAt = inviteRow.expires_at ? String(inviteRow.expires_at) : null;
    if (expiresAt && new Date(expiresAt).toISOString() <= new Date().toISOString()) {
      await database.execute({
        sql: "UPDATE board_invites SET is_active = 0 WHERE id = ?",
        args: [Number(inviteRow.id ?? 0)],
      });
      return NextResponse.json({ invite: null });
    }

    if (String(inviteRow.scope ?? "admin") === "admin" && role !== "admin" && user.is_admin !== 1) {
      return NextResponse.json({ invite: null });
    }

    return NextResponse.json({
      invite: {
        code: String(inviteRow.code ?? ""),
        scope: String(inviteRow.scope ?? "admin"),
        expires_at: expiresAt,
        max_uses: Number(inviteRow.max_uses ?? 0),
        uses: Number(inviteRow.uses ?? 0),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load invite.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to load invite." : message;
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

    const payload = (await request.json()) as InvitePayload;
    const boardId = Number(payload.board_id ?? 0);
    const maxUsesRaw = Number(payload.max_uses ?? 0);
    const maxUses = Number.isFinite(maxUsesRaw) ? Math.max(0, Math.trunc(maxUsesRaw)) : 0;
    const expiresAt = payload.expires_at?.trim();
    const scope = normalizeScope(payload.scope);

    if (!Number.isFinite(boardId) || boardId < 1) {
      return NextResponse.json({ error: "board_id is required." }, { status: 400 });
    }

    await ensureSchema();
    const database = db();
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at, users.is_admin FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (user.is_admin !== 1) {
      const memberResult = await database.execute({
        sql: "SELECT role, status FROM board_members WHERE board_id = ? AND user_id = ?",
        args: [boardId, user.id],
      });
      const memberRow = memberResult.rows[0] as Record<string, unknown> | undefined;
      const role = String(memberRow?.role ?? "");
      const status = String(memberRow?.status ?? "");
      if (status !== "active" || role !== "admin") {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    let expiresAtValue: string | null = null;
    if (expiresAt) {
      const date = new Date(expiresAt);
      if (Number.isNaN(date.valueOf())) {
        return NextResponse.json({ error: "Invalid expires_at." }, { status: 400 });
      }
      expiresAtValue = date.toISOString();
    }

    const code = createCode();
    const createdAt = new Date().toISOString();
    await database.batch([
      {
        sql: "UPDATE board_invites SET is_active = 0 WHERE board_id = ?",
        args: [boardId],
      },
      {
        sql: "INSERT INTO board_invites (board_id, code, created_by, created_at, expires_at, max_uses, uses, is_active, scope) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)",
        args: [boardId, code, user.id, createdAt, expiresAtValue, maxUses, scope],
      },
    ]);

    return NextResponse.json({ success: true, code, scope });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create invite.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to create invite." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
