import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

type LoginPayload = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LoginPayload;
    const username = payload.username?.trim();
    const password = payload.password ?? "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 },
      );
    }

    await ensureSchema();
    const database = db();

    const userResult = await database.execute({
      sql: "SELECT id, username, password_hash, telegram_user_id, created_at FROM users WHERE username = ?",
      args: [username],
    });

    const user = normalizeUserRow(
      userResult.rows[0] as Record<string, unknown> | undefined,
    );

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 },
      );
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to log in right now.";
    const safeMessage =
      process.env.NODE_ENV === "production"
        ? "Unable to log in right now."
        : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
