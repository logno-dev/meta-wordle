import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeLetterRow, normalizeUserRow } from "@/lib/db-utils";
import { BASE_INVENTORY } from "@/lib/letters";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramUserId = searchParams.get("telegram_user_id")?.trim();
    const username = searchParams.get("username")?.trim();
    const boardIdParam = Number(searchParams.get("board_id") ?? 1);
    const boardId = Number.isFinite(boardIdParam) ? Math.trunc(boardIdParam) : null;
    if (!boardId || boardId < 1) {
      return NextResponse.json({ error: "board_id is required." }, { status: 400 });
    }

    await ensureSchema();
    const database = db();

    let user: ReturnType<typeof normalizeUserRow> | undefined;

    if (telegramUserId || username) {
      const lookupValue = telegramUserId ?? username;
      if (!lookupValue) {
        return NextResponse.json(
          { error: "telegram_user_id or username is required." },
          { status: 400 },
        );
      }

      const userResult = await database.execute({
        sql: telegramUserId
          ? "SELECT id, username, password_hash, telegram_user_id, created_at, total_score FROM users WHERE telegram_user_id = ?"
          : "SELECT id, username, password_hash, telegram_user_id, created_at, total_score FROM users WHERE username = ?",
        args: [lookupValue],
      });

      user = normalizeUserRow(
        userResult.rows[0] as Record<string, unknown> | undefined,
      );
    } else {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get("session_token")?.value;
      if (!sessionToken) {
        return NextResponse.json(
          { error: "telegram_user_id or username is required." },
          { status: 400 },
        );
      }

      const sessionResult = await database.execute({
        sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at, users.total_score FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
        args: [sessionToken, new Date().toISOString()],
      });

      user = normalizeUserRow(
        sessionResult.rows[0] as Record<string, unknown> | undefined,
      );
    }

    if (!user?.id) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const memberResult = await database.execute({
      sql: "SELECT status, total_score FROM board_members WHERE board_id = ? AND user_id = ?",
      args: [boardId, user.id],
    });
    const memberRow = memberResult.rows[0] as Record<string, unknown> | undefined;
    const memberStatus = String(memberRow?.status ?? "");
    if (memberStatus !== "active") {
      return NextResponse.json({ error: "Not a board member." }, { status: 403 });
    }

    let lettersResult = await database.execute({
      sql: "SELECT letter, quantity, updated_at FROM user_letters WHERE board_id = ? AND user_id = ? ORDER BY letter ASC",
      args: [boardId, user.id],
    });

    if (lettersResult.rows.length === 0 && BASE_INVENTORY.length > 0) {
      const createdAt = new Date().toISOString();
      const statements = BASE_INVENTORY.map((entry) => ({
        sql: "INSERT INTO user_letters (board_id, user_id, letter, quantity, updated_at) VALUES (?, ?, ?, ?, ?)",
        args: [boardId, user.id, entry.letter, entry.quantity, createdAt],
      }));
      await database.batch(statements);
      lettersResult = await database.execute({
        sql: "SELECT letter, quantity, updated_at FROM user_letters WHERE board_id = ? AND user_id = ? ORDER BY letter ASC",
        args: [boardId, user.id],
      });
    }

    const letters = lettersResult.rows
      .map((row) => normalizeLetterRow(row as Record<string, unknown>))
      .filter(Boolean);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        telegram_user_id: user.telegram_user_id,
        total_score: Number(memberRow?.total_score ?? 0),
      },
      letters,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch letters.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to fetch letters." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
