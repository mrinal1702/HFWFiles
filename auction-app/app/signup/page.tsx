"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const displayName = String(fd.get("display_name") ?? "").trim();

    if (password.length < 6) {
      setPending(false);
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!displayName) {
      setPending(false);
      setError("Display name is required.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md flex-1 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign up</h1>
      <p className="mt-2 text-sm text-neutral-500">
        One account for all auctions. Email confirmation is optional (turn off in Supabase for easiest
        testing).
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Display name</span>
          <input
            name="display_name"
            type="text"
            autoComplete="nickname"
            required
            maxLength={80}
            className="rounded-md border border-neutral-600 bg-neutral-900 px-3 py-2 text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-md border border-neutral-600 bg-neutral-900 px-3 py-2 text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Password (min 6)</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="rounded-md border border-neutral-600 bg-neutral-900 px-3 py-2 text-neutral-100"
          />
        </label>
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {pending ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="mt-6 text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="text-neutral-300 underline hover:text-white">
          Log in
        </Link>
      </p>
      <p className="mt-4 text-sm">
        <Link href="/" className="text-neutral-400 underline hover:text-neutral-200">
          ← Home
        </Link>
      </p>
    </main>
  );
}
