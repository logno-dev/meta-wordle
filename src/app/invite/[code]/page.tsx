import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/db";
import { normalizeUserRow } from "@/lib/db-utils";
import InviteJoinPanel from "./InviteJoinPanel";

type InvitePageProps = {
  params: Promise<{ code: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;
  const normalizedCode = code.trim().toUpperCase();

  await ensureSchema();
  const database = db();
  const inviteResult = await database.execute({
    sql: "SELECT board_invites.code, board_invites.expires_at, board_invites.max_uses, board_invites.uses, boards.id as board_id, boards.name FROM board_invites JOIN boards ON board_invites.board_id = boards.id WHERE board_invites.code = ? AND board_invites.is_active = 1",
    args: [normalizedCode],
  });
  const inviteRow = inviteResult.rows[0] as Record<string, unknown> | undefined;

  const isExpired = inviteRow?.expires_at
    ? new Date(String(inviteRow.expires_at)).toISOString() <= new Date().toISOString()
    : false;
  const maxUses = Number(inviteRow?.max_uses ?? 0);
  const uses = Number(inviteRow?.uses ?? 0);
  const isMaxed = maxUses > 0 && uses >= maxUses;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  let isLoggedIn = false;
  if (sessionToken) {
    const sessionResult = await database.execute({
      sql: "SELECT users.id, users.username, users.password_hash, users.telegram_user_id, users.created_at FROM user_sessions JOIN users ON user_sessions.user_id = users.id WHERE user_sessions.token = ? AND user_sessions.expires_at > ?",
      args: [sessionToken, new Date().toISOString()],
    });
    const user = normalizeUserRow(
      sessionResult.rows[0] as Record<string, unknown> | undefined,
    );
    isLoggedIn = Boolean(user?.id);
  }

  const boardName = inviteRow ? String(inviteRow.board_name ?? inviteRow.name ?? "Board") : "";
  const boardId = inviteRow ? Number(inviteRow.board_id ?? 0) : 0;
  const isValid = Boolean(inviteRow && !isExpired && !isMaxed);

  return (
    <div className="relative min-h-screen px-6 py-14 sm:px-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-200/60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-24 rounded-full bg-rose-200/70 blur-3xl" />
      </div>
      <main className="relative mx-auto flex w-full max-w-xl flex-col gap-8">
        <a
          href="/"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
        >
          Wordle Board
        </a>
        <InviteJoinPanel
          code={normalizedCode}
          boardName={boardName}
          boardId={boardId}
          isLoggedIn={isLoggedIn}
          isValid={isValid}
          isExpired={isExpired}
          isMaxed={isMaxed}
        />
      </main>
    </div>
  );
}
