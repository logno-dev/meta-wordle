"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

type Board = {
  id: number;
  name: string;
  visibility: string;
  role: string;
  total_score: number;
  member_count: number;
};

type Member = {
  id: number;
  username: string;
  role: string;
  status: string;
  total_score: number;
};

type Invite = {
  code: string;
  scope: string;
  expires_at: string | null;
  max_uses: number;
  uses: number;
} | null;

export default function BoardsPanel() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [publicBoards, setPublicBoards] = useState<Board[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [publicStatus, setPublicStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [expandedBoards, setExpandedBoards] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyHint, setCopyHint] = useState<
    { boardId: number; kind: "code" | "link" } | null
  >(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [invites, setInvites] = useState<Record<number, Invite>>({});
  const [membersByBoard, setMembersByBoard] = useState<Record<number, Member[]>>({});
  const [membersLoading, setMembersLoading] = useState<Record<number, boolean>>({});
  const [resetting, setResetting] = useState<Record<number, boolean>>({});
  const [resetConfirm, setResetConfirm] = useState<Board | null>(null);

  const loadBoards = async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/boards");
      const data = (await response.json()) as { boards?: Array<Record<string, unknown>> };
      if (!response.ok) {
        setStatus("error");
        return;
      }
      const nextBoards = (data.boards ?? []).map((row) => ({
        id: Number(row.id ?? 0),
        name: String(row.name ?? ""),
        visibility: String(row.visibility ?? "private"),
        role: String(row.role ?? "member"),
        total_score: Number(row.total_score ?? 0),
        member_count: Number(row.member_count ?? 0),
      }));
      setBoards(nextBoards.filter((board) => Number.isFinite(board.id) && board.id > 0));
      setStatus("idle");
    } catch (error) {
      setStatus("error");
    }
  };

  const loadPublicBoards = async () => {
    setPublicStatus("loading");
    try {
      const response = await fetch("/api/boards/public");
      const data = (await response.json()) as { boards?: Array<Record<string, unknown>> };
      if (!response.ok) {
        setPublicStatus("error");
        return;
      }
      const nextBoards = (data.boards ?? []).map((row) => ({
        id: Number(row.id ?? 0),
        name: String(row.name ?? ""),
        visibility: String(row.visibility ?? "public"),
        role: "member",
        total_score: 0,
        member_count: Number(row.member_count ?? 0),
      }));
      setPublicBoards(nextBoards.filter((board) => Number.isFinite(board.id) && board.id > 0));
      setPublicStatus("idle");
    } catch (error) {
      setPublicStatus("error");
    }
  };

  useEffect(() => {
    loadBoards();
    loadPublicBoards();
  }, []);

  const handleCreateBoard = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const visibility = String(formData.get("visibility") ?? "private");

    try {
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, visibility }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Unable to create board.");
        return;
      }
      form.reset();
      setMessage("Board created.");
      await loadBoards();
    } catch (error) {
      setMessage("Unable to create board.");
    }
  };

  const handleJoinBoard = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const code = String(formData.get("code") ?? "").trim();

    try {
      const response = await fetch("/api/boards/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Unable to join board.");
        return;
      }
      form.reset();
      setMessage("Joined board.");
      await loadBoards();
      await loadPublicBoards();
    } catch (error) {
      setMessage("Unable to join board.");
    }
  };

  const handleJoinPublicBoard = async (boardId: number) => {
    setMessage(null);
    try {
      const response = await fetch("/api/boards/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Unable to join board.");
        return;
      }
      setMessage("Joined board.");
      await loadBoards();
      await loadPublicBoards();
    } catch (error) {
      setMessage("Unable to join board.");
    }
  };

  const handleInvite = async (boardId: number) => {
    setMessage(null);
    try {
      const scope = invites[boardId]?.scope ?? "admin";
      const response = await fetch("/api/boards/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId, scope }),
      });
      const data = (await response.json()) as { code?: string; error?: string };
      if (!response.ok || !data.code) {
        setMessage(data.error ?? "Unable to create invite.");
        return;
      }
      setInvites((prev) => ({
        ...prev,
        [boardId]: {
          code: data.code ?? "",
          scope: String((data as Record<string, unknown>).scope ?? "admin"),
          expires_at: null,
          max_uses: 0,
          uses: 0,
        },
      }));
    } catch (error) {
      setMessage("Unable to create invite.");
    }
  };

  const handleLoadInvite = async (boardId: number) => {
    try {
      const response = await fetch(`/api/boards/invite?board_id=${boardId}`);
      const data = (await response.json()) as { invite?: Invite; error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Unable to load invite.");
        return;
      }
      setInvites((prev) => ({ ...prev, [boardId]: data.invite ?? null }));
    } catch (error) {
      setMessage("Unable to load invite.");
    }
  };

  useEffect(() => {
    boards.forEach((board) => {
      handleLoadInvite(board.id);
    });
  }, [boards]);

  const handleRemoveInvite = async (boardId: number) => {
    setMessage(null);
    try {
      const response = await fetch("/api/boards/invite/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Unable to remove invite.");
        return;
      }
      setInvites((prev) => ({ ...prev, [boardId]: null }));
    } catch (error) {
      setMessage("Unable to remove invite.");
    }
  };

  const handleScopeUpdate = async (boardId: number, scope: string) => {
    try {
      const response = await fetch("/api/boards/invite/scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId, scope }),
      });
      const data = (await response.json()) as { error?: string; scope?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Unable to update invite.");
        return;
      }
      setInvites((prev) => ({
        ...prev,
        [boardId]: prev[boardId]
          ? { ...prev[boardId], scope: String(data.scope ?? scope) }
          : prev[boardId],
      }));
    } catch (error) {
      setMessage("Unable to update invite.");
    }
  };

  const handleCopyInvite = async (boardId: number, code: string) => {
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopyHint({ boardId, kind: "code" });
    } catch (error) {
      setMessage("Unable to copy invite code.");
    }
  };

  const handleCopyInviteLink = async (boardId: number, code: string) => {
    if (!code) {
      return;
    }
    try {
      const link = `${window.location.origin}/invite/${code}`;
      await navigator.clipboard.writeText(link);
      setCopyHint({ boardId, kind: "link" });
    } catch (error) {
      setMessage("Unable to copy invite link.");
    }
  };

  const handleVisibility = async (boardId: number, visibility: string) => {
    try {
      const response = await fetch("/api/boards/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId, visibility }),
      });
      const data = (await response.json()) as { error?: string; visibility?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Unable to update visibility.");
        return;
      }
      setBoards((prev) =>
        prev.map((board) =>
          board.id === boardId
            ? { ...board, visibility: String(data.visibility ?? visibility) }
            : board,
        ),
      );
      await loadPublicBoards();
    } catch (error) {
      setMessage("Unable to update visibility.");
    }
  };

  useEffect(() => {
    if (!message) {
      return undefined;
    }
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setMessage(null);
      toastTimerRef.current = null;
    }, 2400);
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [message]);

  useEffect(() => {
    if (!copyHint) {
      return undefined;
    }
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopyHint(null);
      copyTimerRef.current = null;
    }, 1400);
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, [copyHint]);

  const handleLoadMembers = async (boardId: number) => {
    setMembersLoading((prev) => ({ ...prev, [boardId]: true }));
    try {
      const response = await fetch(`/api/boards/members?board_id=${boardId}`);
      const data = (await response.json()) as { members?: Array<Record<string, unknown>> };
      if (!response.ok) {
        setMessage("Unable to load members.");
        return;
      }
      const members = (data.members ?? []).map((row) => ({
        id: Number(row.id ?? 0),
        username: String(row.username ?? ""),
        role: String(row.role ?? "member"),
        status: String(row.status ?? ""),
        total_score: Number(row.total_score ?? 0),
      }));
      setMembersByBoard((prev) => ({ ...prev, [boardId]: members }));
    } catch (error) {
      setMessage("Unable to load members.");
    } finally {
      setMembersLoading((prev) => ({ ...prev, [boardId]: false }));
    }
  };

  const handleBoot = async (boardId: number, userId: number) => {
    setMessage(null);
    try {
      const response = await fetch("/api/boards/boot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId, user_id: userId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Unable to remove member.");
        return;
      }
      await handleLoadMembers(boardId);
      await loadBoards();
    } catch (error) {
      setMessage("Unable to remove member.");
    }
  };

  const handleRole = async (boardId: number, userId: number, role: string) => {
    setMessage(null);
    try {
      const response = await fetch("/api/boards/members/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId, user_id: userId, role }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Unable to update role.");
        return;
      }
      await handleLoadMembers(boardId);
      await loadBoards();
    } catch (error) {
      setMessage("Unable to update role.");
    }
  };

  const handleReset = async (boardId: number) => {
    setResetting((prev) => ({ ...prev, [boardId]: true }));
    setMessage(null);
    try {
      const response = await fetch("/api/boards/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board_id: boardId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Unable to reset board.");
        return;
      }
      setMessage("Board reset and seeded.");
    } catch (error) {
      setMessage("Unable to reset board.");
    } finally {
      setResetting((prev) => ({ ...prev, [boardId]: false }));
    }
  };

  const confirmReset = async () => {
    if (!resetConfirm) {
      return;
    }
    const boardId = resetConfirm.id;
    setResetConfirm(null);
    await handleReset(boardId);
  };

  const toggleBoardDetails = (boardId: number) => {
    setExpandedBoards((prev) => ({ ...prev, [boardId]: !prev[boardId] }));
  };

  return (
    <div className="grid gap-6">
      <section className="grid gap-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
          Your boards
        </div>
        {status === "loading" && boards.length === 0 ? (
          <div className="grid gap-4">
            {[0, 1].map((index) => (
              <div
                key={`board-skeleton-${index}`}
                className="animate-pulse rounded-3xl border border-black/10 bg-white/85 p-6 shadow-2xl shadow-black/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="h-7 w-40 rounded-full bg-black/10" />
                  <div className="flex items-center gap-2">
                    <div className="h-11 w-32 rounded-full bg-[#d76f4b]/30" />
                    <div className="h-11 w-11 rounded-full bg-black/10" />
                  </div>
                </div>
                <div className="mt-4 h-4 w-56 rounded-full bg-black/5" />
              </div>
            ))}
          </div>
        ) : null}
        {status === "error" ? <div>Unable to load boards.</div> : null}
        {status === "idle" && boards.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-[#5a4d43]">
            You are not a member of any boards yet.
          </div>
        ) : null}
        {boards.map((board) => (
          <div
            key={board.id}
            className="rounded-3xl border border-black/10 bg-white/85 p-6 shadow-2xl shadow-black/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display text-2xl text-[#241c15]">
                  {board.name}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/board/${board.id}`}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[#d76f4b] px-6 text-sm font-semibold text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231]"
                >
                  Enter board
                </Link>
                <button
                  type="button"
                  onClick={() => toggleBoardDetails(board.id)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/80 text-[#6b4b3d] shadow-lg shadow-black/5"
                  aria-label="Toggle board details"
                  aria-expanded={Boolean(expandedBoards[board.id])}
                >
                  {expandedBoards[board.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>
            </div>

            {expandedBoards[board.id] ? (
              <div className="mt-4 grid gap-3 rounded-2xl border border-black/5 bg-[#fff7ef] p-4 text-sm text-[#5a4d43]">
                <div className="text-xs uppercase tracking-[0.2em] text-[#6b4b3d]">
                  {board.visibility} · {board.member_count} members · {board.role} · your score {board.total_score}
                </div>
                {board.role === "admin" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={board.visibility}
                      onChange={(event) =>
                        handleVisibility(board.id, event.currentTarget.value)
                      }
                      className="h-9 rounded-full border border-black/10 bg-white px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
                    >
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </select>
                    {invites[board.id]?.code ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleInvite(board.id)}
                          className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
                        >
                          Reset invite
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveInvite(board.id)}
                          className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b45231]"
                        >
                          Remove code
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInvite(board.id)}
                        className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
                      >
                        Create invite
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleLoadMembers(board.id)}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
                    >
                      View members
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetConfirm(board)}
                      disabled={Boolean(resetting[board.id])}
                      className="inline-flex h-9 items-center justify-center rounded-full bg-[#b45231] px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-white shadow-sm shadow-black/10 disabled:opacity-60"
                    >
                      {resetting[board.id] ? "Resetting..." : "Reset board"}
                    </button>
                  </div>
                ) : null}
                {invites[board.id]?.code ? (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#6b4b3d]">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyInvite(board.id, invites[board.id]?.code ?? "")
                        }
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
                      >
                        Copy code
                      </button>
                      {copyHint?.boardId === board.id && copyHint.kind === "code" ? (
                        <div className="pointer-events-none absolute left-1/2 top-[-36px] w-max -translate-x-1/2 rounded-full bg-[#241c15] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white shadow-lg shadow-black/20">
                          Copied
                        </div>
                      ) : null}
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyInviteLink(board.id, invites[board.id]?.code ?? "")
                        }
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
                      >
                        Copy link
                      </button>
                      {copyHint?.boardId === board.id && copyHint.kind === "link" ? (
                        <div className="pointer-events-none absolute left-1/2 top-[-36px] w-max -translate-x-1/2 rounded-full bg-[#241c15] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white shadow-lg shadow-black/20">
                          Copied
                        </div>
                      ) : null}
                    </div>
                    <span className="flex items-center gap-2">
                      <span>Invite code:</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyInvite(board.id, invites[board.id]?.code ?? "")
                        }
                        className="font-semibold"
                      >
                        {invites[board.id]?.code}
                      </button>
                    </span>
                    {board.role === "admin" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-[0.2em]">Visible to</span>
                        <select
                          value={invites[board.id]?.scope ?? "admin"}
                          onChange={(event) =>
                            handleScopeUpdate(board.id, event.currentTarget.value)
                          }
                          className="h-7 rounded-full border border-black/10 bg-white px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
                        >
                          <option value="admin">Admins only</option>
                          <option value="member">All members</option>
                        </select>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {membersLoading[board.id] ? <div>Loading members...</div> : null}
                {membersByBoard[board.id] ? (
                  <div className="grid gap-2">
                    {membersByBoard[board.id].map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-2xl border border-black/5 bg-white px-3 py-2"
                      >
                        <div>
                          <div className="text-xs font-semibold uppercase text-[#241c15]">
                            {member.username}
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.2em] text-[#6b4b3d]">
                            {member.role} · {member.status}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleRole(
                                board.id,
                                member.id,
                                member.role === "admin" ? "member" : "admin",
                              )
                            }
                            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
                          >
                            {member.role === "admin" ? "Remove admin" : "Make admin"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBoot(board.id, member.id)}
                            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b45231]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <section className="grid gap-4 rounded-3xl border border-black/10 bg-white/85 p-6 shadow-2xl shadow-black/10 lg:grid-cols-2">
        <form className="grid gap-3" onSubmit={handleCreateBoard}>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
            Create board
          </div>
          <input
            name="name"
            required
            placeholder="Board name"
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#241c15] outline-none ring-orange-200/70 transition focus:ring-4"
          />
          <select
            name="visibility"
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#241c15] outline-none ring-orange-200/70 transition focus:ring-4"
            defaultValue="private"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#d76f4b] px-6 text-sm font-semibold text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231]"
          >
            Create board
          </button>
        </form>
        <form className="grid gap-3" onSubmit={handleJoinBoard}>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
            Join with code
          </div>
          <input
            name="code"
            required
            placeholder="Invite code"
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#241c15] outline-none ring-orange-200/70 transition focus:ring-4"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-sm font-semibold text-[#b45231] shadow-lg shadow-black/5 transition hover:bg-[#fff1e7]"
          >
            Join board
          </button>
        </form>
      </section>

      <section className="grid gap-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
          Discover public boards
        </div>
        {publicStatus === "loading" && publicBoards.length === 0 ? (
          <div className="grid gap-4">
            {[0, 1].map((index) => (
              <div
                key={`public-skeleton-${index}`}
                className="animate-pulse rounded-3xl border border-black/10 bg-white/85 p-6 shadow-2xl shadow-black/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="h-7 w-44 rounded-full bg-black/10" />
                    <div className="mt-2 h-3 w-32 rounded-full bg-black/5" />
                  </div>
                  <div className="h-11 w-32 rounded-full bg-black/10" />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {publicStatus === "error" ? <div>Unable to load public boards.</div> : null}
        {publicStatus === "idle" && publicBoards.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-[#5a4d43]">
            No public boards available right now.
          </div>
        ) : null}
        {publicBoards.map((board) => (
          <div
            key={board.id}
            className="rounded-3xl border border-black/10 bg-white/85 p-6 shadow-2xl shadow-black/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display text-2xl text-[#241c15]">
                  {board.name}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[#6b4b3d]">
                  Public · {board.member_count} members
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleJoinPublicBoard(board.id)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-sm font-semibold text-[#b45231] shadow-lg shadow-black/5 transition hover:bg-[#fff1e7]"
              >
                Join board
              </button>
            </div>
          </div>
        ))}
      </section>
      {message ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 rounded-2xl border border-black/10 bg-white/95 px-4 py-3 text-sm text-[#5a4d43] shadow-2xl shadow-black/10">
          {message}
        </div>
      ) : null}
      {resetConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 text-[#241c15] shadow-2xl shadow-black/20">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
              Reset board
            </div>
            <h2 className="mt-3 font-display text-2xl">This cannot be undone</h2>
            <p className="mt-3 text-sm text-[#5a4d43]">
              Resetting “{resetConfirm.name}” will archive the current board, clear
              all tiles, reset scores, and seed a new starting word.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetConfirm(null)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReset}
                className="inline-flex h-10 items-center justify-center rounded-full bg-[#b45231] px-4 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-sm shadow-black/10"
              >
                Reset board
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
