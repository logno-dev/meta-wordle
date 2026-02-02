import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, ensureSchema } from "@/lib/db";

type ResetPayload = {
  token?: string;
  password?: string;
  confirmPassword?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ResetPayload;
    const token = payload.token?.trim();
    const password = payload.password ?? "";
    const confirmPassword = payload.confirmPassword ?? "";

    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
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
      sql: "SELECT token, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ?",
      args: [token],
    });
    const tokenRow = tokenResult.rows[0] as Record<string, unknown> | undefined;
    if (!tokenRow) {
      return NextResponse.json({ error: "Invalid token." }, { status: 404 });
    }
    if (tokenRow.used_at) {
      return NextResponse.json({ error: "Token already used." }, { status: 409 });
    }
    const expiresAt = new Date(String(tokenRow.expires_at)).toISOString();
    if (expiresAt <= new Date().toISOString()) {
      return NextResponse.json({ error: "Token expired." }, { status: 410 });
    }

    const userId = String(tokenRow.user_id ?? "");
    if (!userId) {
      return NextResponse.json({ error: "Invalid token." }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usedAt = new Date().toISOString();
    await database.batch([
      {
        sql: "UPDATE users SET password_hash = ? WHERE id = ?",
        args: [passwordHash, userId],
      },
      {
        sql: "UPDATE password_reset_tokens SET used_at = ? WHERE token = ?",
        args: [usedAt, token],
      },
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reset password.";
    const safeMessage =
      process.env.NODE_ENV === "production"
        ? "Unable to reset password."
        : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
