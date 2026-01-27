"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("loading");
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      username: String(formData.get("username") || "").trim(),
      password: String(formData.get("password") || ""),
    };

    try {
      const response = await fetch("/api/login", {
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
      setMessage("Logged in. Sending you to the board...");
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
      <h1 className="font-display text-3xl text-[#241c15]">Log in</h1>
      <p className="mt-3 text-sm text-[#5a4d43]">
        Use the username and password you created from the Telegram link.
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
            autoComplete="current-password"
            required
            placeholder="Your password"
            className="h-12 rounded-2xl border border-black/10 bg-white px-4 text-base text-[#241c15] outline-none ring-orange-200/70 transition focus:ring-4"
          />
        </label>

        <button
          type="submit"
          disabled={status === "loading"}
          className="mt-2 flex h-12 items-center justify-center rounded-full bg-[#d76f4b] text-sm font-semibold text-white shadow-lg shadow-orange-200/70 transition hover:bg-[#b45231] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? "Signing in..." : "Sign in"}
        </button>
      </form>

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
