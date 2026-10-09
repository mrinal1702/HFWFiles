"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  AuthError,
  AuthField,
  AuthFooterPill,
  AuthShell,
  authField as field,
  authPrimaryButton,
} from "@/app/_components/AuthShell";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";


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
      <AuthShell title="Reset password">
        <p className="text-sm text-slate-600">Loading…</p>
      </AuthShell>
    );
  }

  if (!hasSession) {
    return (
      <AuthShell
        eyebrow="Account help"
        title="Reset link expired"
        footer={<AuthFooterPill href="/login">Back to log in</AuthFooterPill>}
      >
        <p className="text-sm leading-relaxed text-slate-700">
          This password reset link is invalid or has expired. Request a new one and try again.
        </p>
        <Link href="/forgot-password" className={`mt-4 ${authPrimaryButton}`}>
          Request new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Almost done"
      title="Choose a new password"
      footer={<AuthFooterPill href="/login">Back to log in</AuthFooterPill>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <AuthField label="New password">
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="At least 6 characters"
            className={field}
          />
        </AuthField>
        <AuthField label="Confirm new password">
          <input
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className={field}
          />
        </AuthField>
        {error && <AuthError>{error}</AuthError>}
        <button type="submit" disabled={pending} className={`mt-1 ${authPrimaryButton}`}>
          {pending ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
