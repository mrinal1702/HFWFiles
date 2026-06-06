"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const field =
  "min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 sm:text-sm";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function checkSession() {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          window.history.replaceState(null, "", window.location.pathname);
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setHasSession(!!session);
      setReady(true);
    }

    void checkSession();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm_password") ?? "");

    if (password.length < 6) {
      setPending(false);
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setPending(false);
      setError("Passwords do not match.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.updateUser({ password });

    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }

    router.push("/dashboard?password_updated=1");
    router.refresh();
  }

  if (!ready) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-center text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Reset link expired
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
          This password reset link is invalid or has expired. Request a new one and try again.
        </p>
        <Link
          href="/forgot-password"
          className="mt-8 min-h-12 rounded-lg bg-sky-600 px-4 py-3 text-center text-base font-medium text-white hover:bg-sky-700"
        >
          Request new link
        </Link>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-slate-600 underline hover:text-slate-900">
            Back to log in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-center text-sm font-medium text-sky-700">Almost done</p>
      <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Choose a new password
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
        Enter your new password below. You&apos;ll use it the next time you log in.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-slate-700">New password (at least 6 characters)</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-slate-700">Confirm new password</span>
          <input
            name="confirm_password"
            type="password"
            autoComplete="new-password"
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
          {pending ? "Saving…" : "Update password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-slate-600 underline hover:text-slate-900">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
