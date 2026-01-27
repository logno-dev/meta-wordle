"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ConnectFormProps = {
  token?: string | null;
};

export default function ConnectForm({ token }: ConnectFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!token) {
      setStatus("error");
      setMessage("Missing token. Please open the latest link from Telegram.");
      return;
    }

    setStatus("loading");
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      token,
      username: String(formData.get("username") || "").trim(),
      password: String(formData.get("password") || ""),
      confirmPassword: String(formData.get("confirmPassword") || ""),
    };

    try {
      const response = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: { error?: string } | null = null;
      try {
        data = (await response.json()) as { error?: string };
      } catch (parseError) {
        data = null;
      }

      if (!response.ok) {
        setStatus("error");
        const fallback = `Request failed (${response.status}).`;
        setMessage(data?.error || fallback);
        return;
      }

      setStatus("success");
      setMessage("Connected! Sending you to the board...");
      form.reset();
      setTimeout(() => router.push("/board"), 500);
    } catch (error) {
      setStatus("error");
      const message =
        error instanceof Error ? error.message : "Network error. Please try again.";
      setMessage(message);
    }
  };

  return (
    <div className="rounded-3xl border border-black/10 bg-white/85 p-8 shadow-2xl shadow-black/10">
      <h1 className="font-display text-3xl text-[#241c15]">Connect your account</h1>
      <p className="mt-3 text-sm text-[#5a4d43]">
        Use the secure link from the Telegram bot to register a username and
        password.
      </p>

      <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium text-[#3c2f27]">
          Username
          <input
            name="username"
            autoComplete="username"
            required
            placeholder="wordweaver"
            className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-base text-[#241c15] outline-none ring-orange-200/70 transition focus:ring-4"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#3c2f27]">
          Password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="8+ characters"
            className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-base text-[#241c15] outline-none ring-orange-200/70 transition focus:ring-4"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#3c2f27]">
          Confirm password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Repeat your password"
            className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-base text-[#241c15] outline-none ring-orange-200/70 transition focus:ring-4"
          />
        </label>

        <button
          type="submit"
          disabled={status === "loading"}
          className="mt-2 flex h-12 items-center justify-center rounded-full bg-[#d76f4b] text-sm font-semibold text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? "Connecting..." : "Create account"}
        </button>
      </form>

      <div className="mt-6 rounded-2xl border border-black/5 bg-[#fff7ef] p-4 text-xs text-[#5a4d43]">
        Token: <span className="font-semibold">{token || "missing"}</span>
      </div>

      {message ? (
        <p
          className={`mt-4 text-sm ${
            status === "success" ? "text-[#2f6b4f]" : "text-[#b45231]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
