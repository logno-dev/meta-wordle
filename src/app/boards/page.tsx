import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";
import BoardsPanel from "./BoardsPanel";
import ThemeToggle from "./ThemeToggle";

export default async function BoardsPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  if (!sessionToken) {
    redirect("/login");
  }

  await ensureSchema();
  const database = db();
  const sessionResult = await database.execute({
    sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
    args: [sessionToken, new Date().toISOString()],
  });
  const user = normalizeUserRow(
    sessionResult.rows[0] as Record<string, unknown> | undefined,
  );
  if (!user?.id) {
    redirect("/login");
  }

  return (
    <div className="relative min-h-screen px-6 py-14 sm:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-200/60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-24 rounded-full bg-rose-200/70 blur-3xl" />
        <div className="absolute top-1/3 left-[-10%] h-64 w-64 rounded-full bg-amber-100/80 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <a
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
          >
            Wordle Board
          </a>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="font-display text-4xl text-[#241c15]">Your boards</h1>
            <ThemeToggle />
          </div>
          <p className="max-w-2xl text-sm text-[#5a4d43]">
            Join or create boards, then pick where to play. Wordle rewards apply
            to every board you belong to.
          </p>
        </header>
        <BoardsPanel />
      </main>
    </div>
  );
}
