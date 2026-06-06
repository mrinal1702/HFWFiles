"use client";

import Link from "next/link";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { passwordRecoveryRedirectUrl } from "@/lib/auth/recovery-redirect-url";

const field =
  "min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 sm:text-sm";

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const supabase = createSupabaseBrowserClient();
    const redirectTo = passwordRecoveryRedirectUrl(window.location.origin);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-center text-sm font-medium text-sky-700">Account help</p>
      <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Reset your password
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
        Enter the email you use to log in. We&apos;ll send you a link to choose a new password.
      </p>

      {sent ? (
        <div
          className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950"
          role="status"
        >
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-emerald-900">
            If an account exists for that email, a reset link is on its way. The link opens a page
            where you can set a new password.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-slate-700">Email</span>
            <input name="email" type="email" autoComplete="email" required className={field} />
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
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-slate-600">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-sky-700 underline hover:text-sky-900">
          Log in
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
