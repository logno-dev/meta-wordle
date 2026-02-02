"use client";

import { useState } from "react";

type ResetFormProps = {
  token: string;
};

export default function ResetForm({ token }: ResetFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "Unable to reset password.");
        return;
      }
      setStatus("success");
      setMessage("Password updated. You can log in now.");
    } catch (error) {
      setStatus("error");
      setMessage("Unable to reset password.");
    }
  };

  return (
    <div className="rounded-3xl border border-black/10 bg-white/85 p-8 shadow-2xl shadow-black/10">
      <h1 className="font-display text-3xl text-[#241c15]">Reset password</h1>
      <p className="mt-2 text-sm text-[#5a4d43]">
        Choose a new password for your account.
      </p>
      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#241c15] outline-none ring-orange-200/70 transition focus:ring-4"
            required
            minLength={8}
          />
        </label>
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]">
          Confirm password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#241c15] outline-none ring-orange-200/70 transition focus:ring-4"
            required
            minLength={8}
          />
        </label>
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#d76f4b] px-6 text-sm font-semibold text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231] disabled:opacity-60"
        >
          {status === "loading" ? "Updating..." : "Update password"}
        </button>
      </form>
      {message ? (
        <div className="mt-4 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-[#5a4d43]">
          {message}
        </div>
      ) : null}
      {status === "success" ? (
        <a
          href="/login"
          className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.2em] text-[#6b4b3d]"
        >
          Go to login
        </a>
      ) : null}
    </div>
  );
}
