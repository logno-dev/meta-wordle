import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

type ResetRequestPayload = {
  telegram_user_id?: string;
};

const RESET_TTL_MINUTES = 30;

export async function POST(request: Request) {
  try {
    const expectedToken = process.env.BOT_API_TOKEN;
    if (expectedToken) {
      const provided = request.headers.get("x-bot-token");
      if (!provided || provided !== expectedToken) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const payload = (await request.json()) as ResetRequestPayload;
    const telegramUserId = payload.telegram_user_id?.trim();
    if (!telegramUserId) {
      return NextResponse.json(
        { error: "telegram_user_id is required." },
        { status: 400 },
      );
    }

    await ensureSchema();
    const database = db();

    const userResult = await database.execute({
      sql: "SELECT id FROM users WHERE telegram_user_id = ?",
      args: [telegramUserId],
    });
    const userId = String(
      (userResult.rows[0] as Record<string, unknown> | undefined)?.id ?? "",
    );
    if (!userId) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const token = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + RESET_TTL_MINUTES * 60 * 1000);

    await database.execute({
      sql: "INSERT INTO password_reset_tokens (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      args: [token, userId, createdAt.toISOString(), expiresAt.toISOString()],
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.APP_BASE_URL ||
      request.headers.get("origin") ||
      "";
    const resetPath = `/reset/${token}`;
    const resetUrl = baseUrl ? `${baseUrl}${resetPath}` : resetPath;

    return NextResponse.json({
      success: true,
      reset_url: resetUrl,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create reset link.";
    const safeMessage =
      process.env.NODE_ENV === "production"
        ? "Unable to create reset link."
        : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
