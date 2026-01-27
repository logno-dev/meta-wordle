import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(100, limitParam))
      : 20;

    await ensureSchema();
    const database = db();
    const result = await database.execute({
      sql: "SELECT username, total_score FROM users WHERE total_score > 0 ORDER BY total_score DESC, username ASC LIMIT ?",
      args: [limit],
    });

    return NextResponse.json({
      players: result.rows,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load leaderboard.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to load leaderboard." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
