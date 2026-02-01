import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";
import { pickAwardLetter } from "@/lib/letters";

type AwardPayload = {
  telegram_user_id?: string;
  wordle_day?: string;
  answer?: string;
  score?: number | string;
  test?: boolean;
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
    if (payload.test) {
      return NextResponse.json({ success: true, test: true });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("/api/award payload", payload);
    }
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
      if (process.env.NODE_ENV !== "production") {
        console.warn("/api/award user not found", telegramUserId);
      }
      return NextResponse.json(
        { error: "User not connected." },
        { status: 404 },
      );
    }

    const membershipResult = await database.execute({
      sql: "SELECT board_id FROM board_members WHERE user_id = ? AND status = 'active'",
      args: [user.id],
    });
    const boardIds = membershipResult.rows
      .map((row) => Number((row as Record<string, unknown>).board_id ?? 0))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (boardIds.length === 0) {
      return NextResponse.json(
        { error: "No active boards." },
        { status: 422 },
      );
    }

    const placeholders = boardIds.map(() => "?").join(",");
    const submissionResult = await database.execute({
      sql: `SELECT board_id FROM wordle_submissions WHERE user_id = ? AND wordle_day = ? AND board_id IN (${placeholders})`,
      args: [user.id, wordleDay, ...boardIds],
    });
    const submittedBoards = new Set(
      submissionResult.rows.map((row) => Number((row as Record<string, unknown>).board_id ?? 0)),
    );
    const targetBoards = boardIds.filter((id) => !submittedBoards.has(id));

    if (targetBoards.length === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("/api/award duplicate submission", {
          user_id: user.id,
          wordle_day: wordleDay,
        });
      }
      return NextResponse.json(
        { error: "Already submitted for this day." },
        { status: 409 },
      );
    }

    const awarded = pickAwardLetter(answer, score);
    if (!awarded) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("/api/award unable to award", { answer, score });
      }
      return NextResponse.json(
        { error: "Unable to award a letter." },
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    const ledgerLabel = `Wordle ${wordleDay}${answer ? ` (${answer.toUpperCase()})` : ""}`;
    const statements = targetBoards.flatMap((boardId) => [
      {
        sql: "INSERT INTO wordle_submissions (board_id, user_id, wordle_day, answer, score, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        args: [boardId, user.id, wordleDay, answer, score, now],
      },
      {
        sql: "INSERT INTO user_letters (board_id, user_id, letter, quantity, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(board_id, user_id, letter) DO UPDATE SET quantity = quantity + 1, updated_at = excluded.updated_at",
        args: [boardId, user.id, awarded, now],
      },
      {
        sql: "INSERT INTO letter_ledger (board_id, user_id, letter, quantity, source, source_id, source_label, created_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)",
        args: [boardId, user.id, awarded, "wordle", wordleDay, ledgerLabel, now],
      },
    ]);
    await database.batch(statements);

    return NextResponse.json({
      success: true,
      letter: awarded,
      score,
      awarded_boards: targetBoards,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("/api/award error", error);
    }
    const message =
      error instanceof Error ? error.message : "Unable to award a letter.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to award a letter." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
