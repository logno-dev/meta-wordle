import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeLetterRow, normalizeUserRow } from "@/lib/db-utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramUserId = searchParams.get("telegram_user_id")?.trim();
    const username = searchParams.get("username")?.trim();

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
          ? "SELECT id, username, password_hash, telegram_user_id, created_at FROM users WHERE telegram_user_id = ?"
          : "SELECT id, username, password_hash, telegram_user_id, created_at FROM users WHERE username = ?",
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
        sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
        args: [sessionToken, new Date().toISOString()],
      });

      user = normalizeUserRow(
        sessionResult.rows[0] as Record<string, unknown> | undefined,
      );
    }

    if (!user?.id) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const lettersResult = await database.execute({
      sql: "SELECT letter, quantity, updated_at FROM user_letters WHERE user_id = ? ORDER BY letter ASC",
      args: [user.id],
    });

    const letters = lettersResult.rows
      .map((row) => normalizeLetterRow(row as Record<string, unknown>))
      .filter(Boolean);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        telegram_user_id: user.telegram_user_id,
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
