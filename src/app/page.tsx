import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  await ensureSchema();
  const database = db();

  let isLoggedIn = false;
  if (sessionToken) {
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at, users.total_score FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );
    isLoggedIn = Boolean(user?.id);
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-200/60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-24 rounded-full bg-rose-200/70 blur-3xl" />
        <div className="absolute top-1/3 left-[-10%] h-64 w-64 rounded-full bg-amber-100/80 blur-3xl" />
      </div>
      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-16 px-6 py-14 sm:px-10">
        <header className="flex flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d] shadow-sm shadow-black/5">
            Wordle x Scrabble League
          </div>
          <h1 className="max-w-2xl font-display text-4xl leading-tight text-[#241c15] sm:text-5xl">
            Earn letters from your Wordle streak, then weave them into a shared
            endless board.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[#5a4d43] sm:text-lg">
            Submit your Wordle results via Telegram, collect weighted Scrabble
            letters, and build words on a living grid that never ends. Every
            play shapes the community board.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={isLoggedIn ? "/board" : "/login"}
              className="flex w-full items-center justify-center rounded-full bg-[#d76f4b] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231] sm:w-auto"
            >
              {isLoggedIn ? "Go to board" : "Log in"}
            </a>
            <div className="flex w-full items-center justify-center rounded-full border border-black/10 bg-white/70 px-6 py-3 text-sm font-semibold text-[#3f332b] shadow-sm shadow-black/5 sm:w-auto">
              Board mode launches with v1
            </div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Submit your Wordle",
              detail:
                "Drop the daily share grid in Telegram. Scores map to weighted letter rewards from the day's solution.",
            },
            {
              title: "Claim letters",
              detail:
                "High scores bias toward high-value Scrabble tiles, but every result keeps a shot at rare letters.",
            },
            {
              title: "Build the board",
              detail:
                "Place words horizontally or vertically on an endless grid, borrowing existing letters to chain plays.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-xl shadow-black/5"
            >
              <h2 className="font-display text-2xl text-[#241c15]">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#5a4d43]">
                {item.detail}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-8 shadow-2xl shadow-black/5">
            <h3 className="font-display text-3xl text-[#241c15]">What you can do today</h3>
            <div className="mt-6 grid gap-4 text-sm text-[#5a4d43]">
              <div className="rounded-2xl border border-dashed border-black/10 bg-[#fff7ef] p-4">
                Connect your Telegram account with a one-time token.
              </div>
              <div className="rounded-2xl border border-dashed border-black/10 bg-[#fff7ef] p-4">
                Track earned letters and see your next playable word.
              </div>
              <div className="rounded-2xl border border-dashed border-black/10 bg-[#fff7ef] p-4">
                Join the first public board once v1 launches.
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-black/10 bg-[#1f1b16] p-8 text-white shadow-2xl shadow-black/10">
            <h3 className="font-display text-3xl">Endless board mode</h3>
            <p className="mt-4 text-sm leading-relaxed text-[#e8d6c6]">
              The board expands as you play. Words must connect, overlap, and
              obey Scrabble adjacency rules. Every play unlocks new lanes for
              the community to explore.
            </p>
            <div className="mt-6 rounded-2xl bg-white/10 p-4 text-xs uppercase tracking-[0.2em] text-[#f9e2cf]">
              We are building this now.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
