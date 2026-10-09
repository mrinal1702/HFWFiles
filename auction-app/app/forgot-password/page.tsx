"use client";

import Link from "next/link";
import { useState } from "react";

import {
  AuthError,
  AuthField,
  AuthFooterPill,
  AuthShell,
  authField as field,
  authPrimaryButton,
} from "@/app/_components/AuthShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { passwordRecoveryRedirectUrl } from "@/lib/auth/recovery-redirect-url";


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
    <AuthShell
      eyebrow="Account help"
      title="Reset your password"
      footer={
        <>
          <p className="text-slate-700">
            Remember your password?{" "}
            <Link href="/login" className="font-semibold text-sky-800 underline-offset-2 hover:underline">
              Log in
            </Link>
          </p>
          <AuthFooterPill href="/">← Back to home</AuthFooterPill>
        </>
      }
    >
      {sent ? (
        <div role="status">
          <p className="font-display text-xl font-semibold uppercase tracking-wide text-emerald-700">
            Check your inbox
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            If an account exists for that email, a reset link is on its way. The link opens a page where you can set
            a new password.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <AuthField label="Email" info="The email you use to log in. We'll send you a link to choose a new password.">
            <input name="email" type="email" autoComplete="email" required className={field} />
          </AuthField>
          {error && <AuthError>{error}</AuthError>}
          <button type="submit" disabled={pending} className={`mt-1 ${authPrimaryButton}`}>
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
