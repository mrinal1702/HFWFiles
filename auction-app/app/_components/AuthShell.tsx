import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { InfoTip } from "@/app/_components/InfoTip";

/** Shared look for Log in, Sign up, Forgot password and Reset password. */

export const authField =
  "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 sm:text-sm";

export const authPrimaryButton =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-sky-700 px-5 py-3 text-base font-semibold text-white shadow-md shadow-sky-200 transition hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none";

export function AuthShell({
  eyebrow,
  title,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  /** Links under the card, e.g. "New here? Create an account". */
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12">
      <div className="overflow-hidden rounded-3xl shadow-lg shadow-sky-900/20">
        <div className="relative flex items-center gap-4 overflow-hidden bg-gradient-to-br from-slate-900 via-sky-900 to-sky-700 px-5 py-5 sm:px-6">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-sky-400/20 blur-2xl"
          />
          <Link
            href="/"
            aria-label="HFW Fantasy Auction home"
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white shadow-md ring-2 ring-white/20"
          >
            <Image
              src="/hfw-auction-logo.png"
              alt=""
              width={768}
              height={768}
              priority
              className="h-full w-full scale-110 object-cover"
            />
          </Link>
          <div className="relative min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-200">{eyebrow}</p>
            )}
            <h1 className="font-display text-2xl font-semibold uppercase leading-tight tracking-wide text-white sm:text-3xl">
              {title}
            </h1>
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-white via-white to-sky-50 p-5 pl-6 sm:p-6 sm:pl-7">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
          {children}
        </div>
      </div>

      {footer && <div className="mt-5 flex flex-col items-center gap-3 text-center text-sm">{footer}</div>}
    </main>
  );
}

/** Label + input wrapper; `info` adds an InfoTip next to the label, `aside` a right-aligned link. */
export function AuthField({
  label,
  info,
  aside,
  children,
}: {
  label: string;
  info?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 font-semibold text-slate-700">
          {label}
          {info && <InfoTip text={info} />}
        </span>
        {aside}
      </span>
      {children}
    </label>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800" role="alert">
      {children}
    </p>
  );
}

/** White pill link under the card (matches "Read the rules" on the landing page). */
export function AuthFooterPill({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center rounded-full border border-white/70 bg-white/80 px-4 text-sm font-semibold text-sky-800 shadow-sm transition hover:bg-white"
    >
      {children}
    </Link>
  );
}
