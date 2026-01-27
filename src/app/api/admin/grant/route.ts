import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

type GrantPayload = {
  username?: string;
  telegram_user_id?: string;
  letters?: Record<string, number>;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = (await request.json()) as GrantPayload;
    const username = payload.username?.trim();
    const telegramUserId = payload.telegram_user_id?.trim();
    const letters = payload.letters ?? {};

    if (!username && !telegramUserId) {
      return NextResponse.json(
        { error: "username or telegram_user_id is required." },
        { status: 400 },
      );
    }

    const entries = Object.entries(letters)
      .map(([letter, quantity]) => ({
        letter: letter.toLowerCase(),
        quantity: Math.max(0, Math.floor(quantity)),
      }))
      .filter((entry) => /^[a-z]$/.test(entry.letter) && entry.quantity > 0);

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "letters payload is required." },
        { status: 400 },
      );
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

    const lookupValue = telegramUserId ?? username;
    if (!lookupValue) {
      return NextResponse.json(
        { error: "username or telegram_user_id is required." },
        { status: 400 },
      );
    }

    const userResult = await database.execute({
      sql: telegramUserId
        ? "SELECT id FROM users WHERE telegram_user_id = ?"
        : "SELECT id FROM users WHERE username = ?",
      args: [lookupValue],
    });
    const userId = String(
      (userResult.rows[0] as Record<string, unknown> | undefined)?.id ?? "",
    );
    if (!userId) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const updatedAt = new Date().toISOString();
    const statements = entries.map((entry) => ({
      sql: "INSERT INTO user_letters (user_id, letter, quantity, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, letter) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = excluded.updated_at",
      args: [userId, entry.letter, entry.quantity, updatedAt],
    }));

    await database.batch(statements);

    return NextResponse.json({ success: true, granted: entries });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to grant letters.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to grant letters." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
