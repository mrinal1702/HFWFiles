"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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


const SIGN_IN_TIMEOUT_MS = 20_000;

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const callbackError = searchParams.get("error");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const supabase = createSupabaseBrowserClient();
    const destination = next.startsWith("/") ? next : "/dashboard";

    try {
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<{ data: null; error: { message: string } }>((resolve) => {
          window.setTimeout(() => {
            resolve({
              data: null,
              error: {
                message:
                  "Sign-in is taking too long. Close other tabs for this site, refresh, and try again. If it still fails, clear cookies for this site.",
              },
            });
          }, SIGN_IN_TIMEOUT_MS);
        }),
      ]);

      if (result.error) {
        setPending(false);
        setError(result.error.message);
        return;
      }

      // Full navigation so auth cookies are definitely sent on the next request
      // (client router.push can look like "nothing happened" if middleware bounces).
      window.location.assign(destination);
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Log in"
      footer={
        <>
          <p className="text-slate-700">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-sky-800 underline-offset-2 hover:underline">
              Create a free account
            </Link>
          </p>
          <AuthFooterPill href="/">← Back to home</AuthFooterPill>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <AuthField label="Email">
          <input name="email" type="email" autoComplete="email" required className={field} />
        </AuthField>
        <AuthField
          label="Password"
          aside={
            <Link href="/forgot-password" className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline">
              Forgot password?
            </Link>
          }
        >
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            className={field}
          />
        </AuthField>
        {(callbackError === "callback" || callbackError === "confirm") && (
          <AuthError>
            That email link couldn&apos;t be completed. Request a new password reset from{" "}
            <Link href="/forgot-password" className="font-semibold underline">
              Forgot password
            </Link>{" "}
            and open the newest email.
          </AuthError>
        )}
        {error && <AuthError>{error}</AuthError>}
        <button type="submit" disabled={pending} className={`mt-1 ${authPrimaryButton}`}>
          {pending ? "Signing in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
