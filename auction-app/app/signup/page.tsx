"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
      setError("Name is required.");
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
    <AuthShell
      eyebrow="It's completely free"
      title="Create your account"
      footer={
        <>
          <p className="text-slate-700">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-sky-800 underline-offset-2 hover:underline">
              Log in
            </Link>
          </p>
          <AuthFooterPill href="/">← Back to home</AuthFooterPill>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <AuthField label="Name" info="Your real name, please — not a nickname or online handle. This is what your league will see.">
          <input
            name="display_name"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            className={field}
          />
        </AuthField>
        <AuthField label="Email" info="Use an email you can access — you'll log in with it, and password resets go here.">
          <input name="email" type="email" autoComplete="email" required className={field} />
        </AuthField>
        <AuthField label="Password">
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
        {error && <AuthError>{error}</AuthError>}
        <button type="submit" disabled={pending} className={`mt-1 ${authPrimaryButton}`}>
          {pending ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </AuthShell>
  );
}
