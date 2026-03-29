"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const field =
  "min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 sm:text-sm";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-center text-sm font-medium text-sky-700">Welcome back</p>
      <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Log in
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
        Enter your email and password to continue.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-slate-700">Email</span>
          <input name="email" type="email" autoComplete="email" required className={field} />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-slate-700">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            className={field}
          />
        </label>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 min-h-12 rounded-lg bg-sky-600 px-4 py-3 text-base font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Log in"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/signup" className="font-medium text-sky-700 underline hover:text-sky-900">
          Create an account
        </Link>
      </p>
      <p className="mt-6 text-center text-sm">
        <Link href="/" className="text-slate-600 underline hover:text-slate-900">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
