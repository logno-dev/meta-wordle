"use client";

import { useState } from "react";

export default function AdminPanel() {
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [grantStatus, setGrantStatus] = useState<string | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<string | null>(null);

  const handleSeed = async () => {
    setSeedStatus("Seeding...");
    try {
      const response = await fetch("/api/admin/seed", { method: "POST" });
      const data = (await response.json()) as { error?: string; word?: string };
      if (!response.ok) {
        setSeedStatus(data?.error || "Unable to seed board.");
        return;
      }
      setSeedStatus(data?.word ? `Seeded: ${data.word}` : "Board already seeded.");
    } catch (error) {
      setSeedStatus(
        error instanceof Error ? error.message : "Unable to seed board.",
      );
    }
  };

  const handleGrant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGrantStatus("Granting...");
    const form = event.currentTarget;
    const formData = new FormData(form);

    const username = String(formData.get("username") || "").trim();
    const lettersRaw = String(formData.get("letters") || "").trim();
    const payload = {
      username,
      letters: parseLetters(lettersRaw),
    };

    try {
      const response = await fetch("/api/admin/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setGrantStatus(data?.error || "Unable to grant letters.");
        return;
      }
      setGrantStatus("Letters granted.");
      form.reset();
    } catch (error) {
      setGrantStatus(
        error instanceof Error ? error.message : "Unable to grant letters.",
      );
    }
  };

  const handleArchive = async () => {
    setArchiveStatus("Archiving...");
    try {
      const response = await fetch("/api/admin/archive", { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setArchiveStatus(data?.error || "Unable to archive board.");
        return;
      }
      setArchiveStatus("Board archived and cleared.");
    } catch (error) {
      setArchiveStatus(
        error instanceof Error ? error.message : "Unable to archive board.",
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <section className="rounded-3xl border border-black/10 bg-white/85 p-8 shadow-2xl shadow-black/10">
        <h1 className="font-display text-3xl text-[#241c15]">Admin console</h1>
        <p className="mt-3 text-sm text-[#5a4d43]">
          Seed the first board word and grant letters to test placements.
        </p>
      </section>

      <section className="rounded-3xl border border-black/10 bg-white/85 p-8 shadow-2xl shadow-black/10">
        <h2 className="font-display text-2xl text-[#241c15]">Archive session</h2>
        <p className="mt-2 text-sm text-[#5a4d43]">
          Stores the current scoreboard and wipes the board. Letter inventories
          remain intact.
        </p>
        <button
          type="button"
          onClick={handleArchive}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-sm font-semibold text-[#b45231] shadow-lg shadow-black/5 transition hover:bg-[#fff1e7]"
        >
          Archive & clear board
        </button>
        {archiveStatus ? (
          <p className="mt-3 text-sm text-[#5a4d43]">{archiveStatus}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-black/10 bg-white/85 p-8 shadow-2xl shadow-black/10">
        <h2 className="font-display text-2xl text-[#241c15]">Seed the board</h2>
        <p className="mt-2 text-sm text-[#5a4d43]">
          Creates a random starter word at (0,0) if the board is empty.
        </p>
        <button
          type="button"
          onClick={handleSeed}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-[#d76f4b] px-6 text-sm font-semibold text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231]"
        >
          Seed board
        </button>
        {seedStatus ? (
          <p className="mt-3 text-sm text-[#5a4d43]">{seedStatus}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-black/10 bg-white/85 p-8 shadow-2xl shadow-black/10">
        <h2 className="font-display text-2xl text-[#241c15]">Grant letters</h2>
        <p className="mt-2 text-sm text-[#5a4d43]">
          Example: <span className="font-semibold">a:3, e:4, r:2, t:1</span>
        </p>
        <form className="mt-4 grid gap-4" onSubmit={handleGrant}>
          <label className="grid gap-2 text-sm font-semibold text-[#3c2f27]">
            Username
            <input
              name="username"
              required
              className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#241c15] outline-none ring-orange-200/70 transition focus:ring-4"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#3c2f27]">
            Letters
            <input
              name="letters"
              required
              placeholder="a:3, e:4, r:2"
              className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#241c15] outline-none ring-orange-200/70 transition focus:ring-4"
            />
          </label>
          <button
            type="submit"
            className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-[#d76f4b] px-6 text-sm font-semibold text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231]"
          >
            Grant letters
          </button>
        </form>
        {grantStatus ? (
          <p className="mt-3 text-sm text-[#5a4d43]">{grantStatus}</p>
        ) : null}
      </section>
    </div>
  );
}

const parseLetters = (input: string) => {
  const result: Record<string, number> = {};
  const parts = input.split(",");
  parts.forEach((part) => {
    const [rawLetter, rawCount] = part.split(":");
    const letter = rawLetter?.trim().toLowerCase();
    const count = Number(rawCount);
    if (letter && /^[a-z]$/.test(letter) && Number.isFinite(count) && count > 0) {
      result[letter] = Math.floor(count);
    }
  });
  return result;
};
