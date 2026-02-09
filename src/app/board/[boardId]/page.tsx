import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, ensureSchema } from "@/lib/db";
import { normalizeLetterRow, normalizeUserRow } from "@/lib/db-utils";
import BoardScene from "../BoardScene";

type BoardPageProps = {
  params: Promise<{ boardId: string }>;
  searchParams?: Promise<{
    username?: string | string[];
    telegram_user_id?: string | string[];
  }>;
};

const normalizeParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

type LetterEntry = {
  letter: string;
  quantity: number;
  updated_at: string | null;
};

type BoardTile = {
  x: number;
  y: number;
  letter: string;
  direction: "horizontal" | "vertical";
  word_id?: number;
};

export default async function BoardPage({ params, searchParams }: BoardPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const username = normalizeParam(resolvedParams?.username);
  const telegramUserId = normalizeParam(resolvedParams?.telegram_user_id);
  const boardParam = await params;
  const boardId = Number(boardParam.boardId);
  if (!Number.isFinite(boardId)) {
    notFound();
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  await ensureSchema();
  const database = db();

  const boardResult = await database.execute({
    sql: "SELECT id, name, visibility FROM boards WHERE id = ?",
    args: [boardId],
  });
  const boardRow = boardResult.rows[0] as Record<string, unknown> | undefined;
  if (!boardRow) {
    notFound();
  }
  const visibility = String(boardRow.visibility ?? "public");

  let user = null as ReturnType<typeof normalizeUserRow> | null;
  let letters: LetterEntry[] = [];
  let tiles: BoardTile[] = [];
  let totalScore = 0;
  let isMember = false;

  if (username || telegramUserId) {
    const lookupValue = telegramUserId ?? username;
    if (lookupValue) {
      const userResult = await database.execute({
        sql: telegramUserId
          ? "SELECT id, username, password_hash, telegram_user_id, created_at, total_score FROM users WHERE telegram_user_id = ?"
          : "SELECT id, username, password_hash, telegram_user_id, created_at, total_score FROM users WHERE username = ?",
        args: [lookupValue],
      });
      user = normalizeUserRow(
        userResult.rows[0] as Record<string, unknown> | undefined,
      );
    }
  } else if (sessionToken) {
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at, users.total_score FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );
  }

  if (user?.id) {
    const memberResult = await database.execute({
      sql: "SELECT role, status, total_score FROM board_members WHERE board_id = ? AND user_id = ?",
      args: [boardId, user.id],
    });
    const memberRow = memberResult.rows[0] as Record<string, unknown> | undefined;
    isMember = String(memberRow?.status ?? "") === "active";
    totalScore = Number(memberRow?.total_score ?? 0);
  }

  if (visibility !== "public" && !isMember) {
    return (
      <div className="relative min-h-screen px-6 py-14 sm:px-10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-200/60 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-24 rounded-full bg-rose-200/70 blur-3xl" />
        </div>
        <main className="relative mx-auto flex w-full max-w-xl flex-col gap-6">
          <Link
            href="/boards"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
          >
            Back to boards
          </Link>
          <div className="rounded-3xl border border-black/10 bg-white/85 p-8 shadow-2xl shadow-black/10">
            <h1 className="font-display text-3xl text-[#241c15]">Private board</h1>
            <p className="mt-3 text-sm text-[#5a4d43]">
              This board is private. Join with an invite code to play.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (user?.id && isMember) {
    const lettersResult = await database.execute({
      sql: "SELECT letter, quantity, updated_at FROM user_letters WHERE board_id = ? AND user_id = ? ORDER BY letter ASC",
      args: [boardId, user.id],
    });
    letters = lettersResult.rows
      .map((row) => normalizeLetterRow(row as Record<string, unknown>))
      .filter((entry): entry is LetterEntry => Boolean(entry));
  }

  const tilesResult = await database.execute({
    sql: "SELECT board_tiles.x, board_tiles.y, board_tiles.letter, board_tiles.word_id, board_words.direction FROM board_tiles JOIN board_words ON board_tiles.word_id = board_words.id WHERE board_tiles.board_id = ?",
    args: [boardId],
  });
  tiles = tilesResult.rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      x: Number(record.x ?? 0),
      y: Number(record.y ?? 0),
      letter: String(record.letter ?? ""),
      direction: record.direction === "vertical" ? "vertical" : "horizontal",
      word_id: Number(record.word_id ?? 0),
    } as BoardTile;
  });

  return (
    <BoardScene
      tiles={tiles}
      letters={letters}
      loggedIn={Boolean(user?.id && isMember)}
      totalScore={totalScore}
      boardId={boardId}
    />
  );
}
