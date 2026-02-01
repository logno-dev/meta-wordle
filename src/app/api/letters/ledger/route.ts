import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    await ensureSchema();
    const database = db();
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at, users.total_score FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );

    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const ledgerResult = await database.execute({
      sql: "SELECT letter, quantity, source, source_id, source_label, created_at FROM letter_ledger WHERE board_id = 1 AND user_id = ? ORDER BY created_at DESC LIMIT ?",
      args: [user.id, limit],
    });

    const entries = ledgerResult.rows.map((row) => ({
      letter: String((row as Record<string, unknown>).letter ?? ""),
      quantity: Number((row as Record<string, unknown>).quantity ?? 0),
      source: String((row as Record<string, unknown>).source ?? ""),
      source_id: (row as Record<string, unknown>).source_id
        ? String((row as Record<string, unknown>).source_id)
        : null,
      source_label: (row as Record<string, unknown>).source_label
        ? String((row as Record<string, unknown>).source_label)
        : null,
      created_at: String((row as Record<string, unknown>).created_at ?? ""),
    }));

    return NextResponse.json({ entries });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load ledger.";
    const safeMessage =
      process.env.NODE_ENV === "production" ? "Unable to load ledger." : message;
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
