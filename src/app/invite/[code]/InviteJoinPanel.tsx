"use client";

import { useState } from "react";

type InviteJoinPanelProps = {
  code: string;
  boardName: string;
  boardId: number;
  isLoggedIn: boolean;
  isValid: boolean;
  isExpired: boolean;
  isMaxed: boolean;
};

export default function InviteJoinPanel({
  code,
  boardName,
  boardId,
  isLoggedIn,
  isValid,
  isExpired,
  isMaxed,
}: InviteJoinPanelProps) {
  const [status, setStatus] = useState<"idle" | "joining" | "error" | "success">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const handleJoin = async () => {
    setStatus("joining");
    setMessage(null);
    try {
      const response = await fetch("/api/boards/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as { error?: string; board_id?: number };
      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "Unable to join board.");
        return;
      }
      setStatus("success");
      setMessage("Joined board.");
      const nextBoardId = Number(data.board_id ?? boardId);
      if (Number.isFinite(nextBoardId) && nextBoardId > 0) {
        window.setTimeout(() => {
          window.location.href = `/board/${nextBoardId}`;
        }, 600);
      }
    } catch (error) {
      setStatus("error");
      setMessage("Unable to join board.");
    }
  };

  return (
    <section className="rounded-3xl border border-black/10 bg-white/85 p-8 shadow-2xl shadow-black/10">
      <h1 className="font-display text-3xl text-[#241c15]">
        {isValid ? "You're invited" : "Invite link"}
      </h1>
      <p className="mt-3 text-sm text-[#5a4d43]">
        {boardName ? `Board: ${boardName}` : "Board invite"}
      </p>

      {!isValid ? (
        <div className="mt-4 rounded-2xl border border-black/5 bg-[#fff7ef] p-4 text-sm text-[#5a4d43]">
          {isExpired
            ? "This invite code has expired."
            : isMaxed
              ? "This invite code has reached its limit."
              : "This invite code is invalid or inactive."}
        </div>
      ) : null}

      {isValid && !isLoggedIn ? (
        <div className="mt-4 grid gap-3 text-sm text-[#5a4d43]">
          <div className="rounded-2xl border border-black/5 bg-[#fff7ef] p-4">
            Already have an account? Log in to join this board.
          </div>
          <a
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#d76f4b] px-6 text-sm font-semibold text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231]"
          >
            Log in
          </a>
          <div className="rounded-2xl border border-black/5 bg-[#fff7ef] p-4">
            Need an account? DM the Telegram bot @logno-bot to get your connection token.
          </div>
        </div>
      ) : null}

      {isValid && isLoggedIn ? (
        <div className="mt-4 grid gap-3">
          <button
            type="button"
            onClick={handleJoin}
            disabled={status === "joining"}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#d76f4b] px-6 text-sm font-semibold text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231] disabled:opacity-60"
          >
            {status === "joining" ? "Joining..." : "Join board"}
          </button>
          {message ? (
            <div className="rounded-2xl border border-black/5 bg-[#fff7ef] px-4 py-3 text-sm text-[#5a4d43]">
              {message}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
