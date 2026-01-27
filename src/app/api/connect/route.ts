import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, ensureSchema } from "@/lib/db";

type ConnectPayload = {
  token?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
};

const isValidUsername = (value: string) => /^[a-zA-Z0-9_]{3,24}$/.test(value);

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ConnectPayload;
    const token = payload.token?.trim();
    const username = payload.username?.trim();
    const password = payload.password ?? "";
    const confirmPassword = payload.confirmPassword ?? "";

    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    if (!username || !isValidUsername(username)) {
      return NextResponse.json(
        { error: "Username must be 3-24 characters (letters, numbers, _)." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 },
      );
    }

    await ensureSchema();
    const database = db();

    const tokenResult = await database.execute({
      sql: "SELECT token, telegram_user_id, used_at FROM telegram_link_tokens WHERE token = ?",
      args: [token],
    });
    const tokenRow = tokenResult.rows[0] as
      | { token: string; telegram_user_id: string; used_at: string | null }
      | undefined;

    if (!tokenRow) {
      return NextResponse.json(
        { error: "Token not found. Please request a new link." },
        { status: 404 },
      );
    }

    if (tokenRow.used_at) {
      return NextResponse.json(
        { error: "Token already used. Request a new link." },
        { status: 409 },
      );
    }

    const existingUser = await database.execute({
      sql: "SELECT id FROM users WHERE username = ?",
      args: [username],
    });

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: "Username already taken." },
        { status: 409 },
      );
    }

    const telegramUser = await database.execute({
      sql: "SELECT id FROM users WHERE telegram_user_id = ?",
      args: [tokenRow.telegram_user_id],
    });

    if (telegramUser.rows.length > 0) {
      return NextResponse.json(
        { error: "Telegram account already linked." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();

    await database.batch([
      {
        sql: "INSERT INTO users (username, password_hash, telegram_user_id, created_at) VALUES (?, ?, ?, ?)",
        args: [username, passwordHash, tokenRow.telegram_user_id, createdAt],
      },
      {
        sql: "UPDATE telegram_link_tokens SET used_at = ?, updated_at = ? WHERE token = ?",
        args: [createdAt, createdAt, token],
      },
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to connect right now." },
      { status: 500 },
    );
  }
}
