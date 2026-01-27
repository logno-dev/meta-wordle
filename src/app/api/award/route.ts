import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";
import { pickAwardLetter } from "@/lib/letters";

type AwardPayload = {
  telegram_user_id?: string;
  wordle_day?: string;
  answer?: string;
  score?: number | string;
};

const normalizeScore = (score: AwardPayload["score"]) => {
  if (typeof score === "number") {
    return score;
  }
  if (!score) {
    return 7;
  }
  if (typeof score === "string" && score.toLowerCase() === "x") {
    return 7;
  }
  const parsed = Number(score);
  return Number.isFinite(parsed) ? parsed : 7;
};

export async function POST(request: Request) {
  try {
    const expectedToken = process.env.BOT_API_TOKEN;
    if (expectedToken) {
      const provided = request.headers.get("x-bot-token");
      if (!provided || provided !== expectedToken) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
    }

    const payload = (await request.json()) as AwardPayload;
    const telegramUserId = payload.telegram_user_id?.trim();
    const wordleDay = payload.wordle_day?.trim();
    const answer = payload.answer?.trim();
    const score = normalizeScore(payload.score);

    if (!telegramUserId || !wordleDay || !answer) {
      return NextResponse.json(
        { error: "telegram_user_id, wordle_day, and answer are required." },
        { status: 400 },
      );
    }

    await ensureSchema();
    const database = db();

    const userResult = await database.execute({
      sql: "SELECT id, username, password_hash, telegram_user_id, created_at FROM users WHERE telegram_user_id = ?",
      args: [telegramUserId],
    });
    const user = normalizeUserRow(
      userResult.rows[0] as Record<string, unknown> | undefined,
    );

    if (!user?.id) {
      return NextResponse.json(
        { error: "User not connected." },
        { status: 404 },
      );
    }

    const submissionResult = await database.execute({
      sql: "SELECT id FROM wordle_submissions WHERE user_id = ? AND wordle_day = ?",
      args: [user.id, wordleDay],
    });

    if (submissionResult.rows.length > 0) {
      return NextResponse.json(
        { error: "Already submitted for this day." },
        { status: 409 },
      );
    }

    const awarded = pickAwardLetter(answer, score);
    if (!awarded) {
      return NextResponse.json(
        { error: "Unable to award a letter." },
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    await database.batch([
      {
        sql: "INSERT INTO wordle_submissions (user_id, wordle_day, answer, score, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [user.id, wordleDay, answer, score, now],
      },
      {
        sql: "INSERT INTO user_letters (user_id, letter, quantity, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id, letter) DO UPDATE SET quantity = quantity + 1, updated_at = excluded.updated_at",
        args: [user.id, awarded, now],
      },
    ]);

    return NextResponse.json({
      success: true,
      letter: awarded,
      score,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to award a letter.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to award a letter." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
