import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

type RolePayload = {
  board_id?: number | string;
  user_id?: number | string;
  role?: string;
};

const normalizeRole = (value?: string) => (value === "admin" ? "admin" : "member");

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = (await request.json()) as RolePayload;
    const boardId = Number(payload.board_id ?? 0);
    const targetUserId = String(payload.user_id ?? "");
    const role = normalizeRole(payload.role);
    if (!Number.isFinite(boardId) || boardId < 1 || !targetUserId) {
      return NextResponse.json(
        { error: "board_id and user_id are required." },
        { status: 400 },
      );
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
    if (String(user.id) === targetUserId && role !== "admin") {
      return NextResponse.json(
        { error: "You cannot remove your own admin role." },
        { status: 400 },
      );
    }

    if (user.is_admin !== 1) {
      const memberResult = await database.execute({
        sql: "SELECT role, status FROM board_members WHERE board_id = ? AND user_id = ?",
        args: [boardId, user.id],
      });
      const memberRow = memberResult.rows[0] as Record<string, unknown> | undefined;
      const memberRole = String(memberRow?.role ?? "");
      const status = String(memberRow?.status ?? "");
      if (status !== "active" || memberRole !== "admin") {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    await database.execute({
      sql: "UPDATE board_members SET role = ? WHERE board_id = ? AND user_id = ?",
      args: [role, boardId, targetUserId],
    });

    return NextResponse.json({ success: true, role });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update role.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to update role." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
