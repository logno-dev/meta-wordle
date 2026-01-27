import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

type GrantAllPayload = {
  letters?: Record<string, number>;
};

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = (await request.json()) as GrantAllPayload;
    const letters = payload.letters ?? {};
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

    const usersResult = await database.execute({
      sql: "SELECT id FROM users",
      args: [],
    });
    const userIds = usersResult.rows
      .map((row) => String((row as Record<string, unknown>).id ?? ""))
      .filter(Boolean);

    const updatedAt = new Date().toISOString();
    const statements = [] as Array<{ sql: string; args: (string | number)[] }>;
    for (const userId of userIds) {
      for (const entry of entries) {
        statements.push({
          sql: "INSERT INTO user_letters (user_id, letter, quantity, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, letter) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = excluded.updated_at",
          args: [userId, entry.letter, entry.quantity, updatedAt],
        });
      }
    }

    if (statements.length > 0) {
      await database.batch(statements);
    }

    return NextResponse.json({ success: true, users: userIds.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to grant letters.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to grant letters." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
