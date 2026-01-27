type BoardPageProps = {
  searchParams?: Promise<{
    username?: string | string[];
    telegram_user_id?: string | string[];
  }>;
};

const normalizeParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeLetterRow, normalizeUserRow } from "@/lib/db-utils";

type LetterEntry = {
  letter: string;
  quantity: number;
  updated_at: string | null;
};

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const username = normalizeParam(resolvedParams?.username);
  const telegramUserId = normalizeParam(resolvedParams?.telegram_user_id);
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  await ensureSchema();
  const database = db();

  let user = null as ReturnType<typeof normalizeUserRow> | null;
  let letters: LetterEntry[] = [];

  if (username || telegramUserId) {
    const lookupValue = telegramUserId ?? username;
    if (lookupValue) {
      const userResult = await database.execute({
        sql: telegramUserId
          ? "SELECT id, username, password_hash, telegram_user_id, created_at FROM users WHERE telegram_user_id = ?"
          : "SELECT id, username, password_hash, telegram_user_id, created_at FROM users WHERE username = ?",
        args: [lookupValue],
      });
      user = normalizeUserRow(
        userResult.rows[0] as Record<string, unknown> | undefined,
      );
    }
  } else if (sessionToken) {
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );
  }

  if (user?.id) {
    const lettersResult = await database.execute({
      sql: "SELECT letter, quantity, updated_at FROM user_letters WHERE user_id = ? ORDER BY letter ASC",
      args: [user.id],
    });
    letters = lettersResult.rows
      .map((row) => normalizeLetterRow(row as Record<string, unknown>))
      .filter((entry): entry is LetterEntry => Boolean(entry));
  }

  return (
    <div className="relative min-h-screen px-6 py-14 sm:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-200/60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-24 rounded-full bg-rose-200/70 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <a
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
          >
            Wordle Board
          </a>
          <h1 className="font-display text-4xl text-[#241c15]">
            The endless board is warming up.
          </h1>
          <p className="max-w-2xl text-sm text-[#5a4d43]">
            This is the future home of the shared grid. Next up: placement rules,
            word validation, and live board state.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-xl shadow-black/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-[#241c15]">Your letters</h2>
                <p className="mt-2 text-sm text-[#5a4d43]">
                  Inventory updates after each Wordle submission.
                </p>
              </div>
              <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[#6b4b3d]">
                Live
              </div>
            </div>
            <div className="mt-4">
              {!user ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-[#fff7ef] p-3 text-xs text-[#5a4d43]">
                  Log in to see your letters on the board.
                </div>
              ) : letters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-[#fff7ef] p-3 text-xs text-[#5a4d43]">
                  No letters yet. Submit a Wordle to earn your first tile.
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {letters.map((entry) => (
                    <div
                      key={entry.letter}
                      className="flex h-12 flex-col items-center justify-center rounded-2xl border border-black/10 bg-white text-xs font-semibold text-[#6b4b3d]"
                    >
                      <span className="text-base uppercase text-[#241c15]">
                        {entry.letter}
                      </span>
                      <span className="text-[10px] text-[#6b4b3d]">
                        x{entry.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-black/10 bg-[#1f1b16] p-6 text-white shadow-xl shadow-black/10">
            <h2 className="font-display text-2xl">Board activity</h2>
            <p className="mt-2 text-sm text-[#e8d6c6]">
              Soon you will see the latest placements and open lanes.
            </p>
            <div className="mt-4 rounded-2xl bg-white/10 p-4 text-xs uppercase tracking-[0.2em] text-[#f9e2cf]">
              Coming soon
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
