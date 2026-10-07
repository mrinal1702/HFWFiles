import Link from "next/link";
import type { ReactNode } from "react";

/** Shared card look for the participant shell (Active Auctions, Archives, Auction History). */
type CardChip = { label?: string; value: string; mono?: boolean };

export const CARD_TONES = {
  participant: {
    card: "border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 hover:border-sky-300 hover:shadow-sky-100",
    stripe: "from-sky-400 to-sky-600",
    icon: "bg-sky-100 text-sky-700 ring-sky-200",
    chip: "border-sky-100 bg-white/80 text-slate-600",
    chevron: "text-sky-300 group-hover:text-sky-600",
  },
  admin: {
    card: "border-rose-100 bg-gradient-to-br from-white via-white to-rose-50 hover:border-rose-300 hover:shadow-rose-100",
    stripe: "from-rose-300 to-rose-500",
    icon: "bg-rose-100 text-rose-700 ring-rose-200",
    chip: "border-rose-100 bg-white/80 text-slate-600",
    chevron: "text-rose-300 group-hover:text-rose-600",
  },
} as const;

export function AuctionCard({
  href,
  tone,
  title,
  subtitle,
  chips = [],
  icon,
  aside,
  children,
}: {
  /** Whole card is a link when set; otherwise a static card (put its actions in `children`). */
  href?: string;
  tone: keyof typeof CARD_TONES;
  title: string;
  subtitle?: string;
  chips?: CardChip[];
  icon?: ReactNode;
  /** Right-hand content, e.g. a finish badge. */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const t = CARD_TONES[tone];
  const body = (
    <>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${t.stripe}`} />
      <span
        aria-hidden
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${t.icon}`}
      >
        {icon ?? (tone === "admin" ? <ShieldIcon /> : <TrophyIcon />)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">{title}</span>
          {tone === "admin" && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
              Admin
            </span>
          )}
        </span>
        {subtitle && <span className="mt-1 block text-xs leading-relaxed text-slate-600">{subtitle}</span>}
        {chips.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c, i) => (
              <span key={i} className={`rounded-md border px-2 py-0.5 text-[11px] leading-5 ${t.chip}`}>
                {c.label && <span className="text-slate-400">{c.label} </span>}
                <span className={c.mono ? "font-mono font-medium text-slate-800" : "font-medium text-slate-700"}>
                  {c.value}
                </span>
              </span>
            ))}
          </span>
        )}
        {children && <span className="mt-3 flex flex-wrap gap-2">{children}</span>}
      </span>
      {aside && <span className="shrink-0">{aside}</span>}
      {href && (
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-5 w-5 shrink-0 transition group-hover:translate-x-0.5 ${t.chevron}`}
        >
          <path
            fillRule="evenodd"
            d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06l-4.27 4.27a.75.75 0 0 1-1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </>
  );
  const base = `relative flex min-h-[4.5rem] gap-3 overflow-hidden rounded-2xl border py-3.5 pl-5 pr-3 shadow-sm sm:gap-4 sm:pl-6 ${t.card}`;
  if (!href) {
    return <div className={`${base} items-start sm:pr-5`}>{body}</div>;
  }
  return (
    <Link href={href} className={`group ${base} items-center transition hover:-translate-y-0.5 hover:shadow-md`}>
      {body}
    </Link>
  );
}

/** Action link inside a static AuctionCard. */
export function CardAction({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "inline-flex min-h-10 items-center rounded-xl bg-gradient-to-r from-sky-500 to-sky-700 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-200 transition hover:-translate-y-0.5 hover:shadow-md"
          : "inline-flex min-h-10 items-center rounded-xl border border-sky-100 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-800"
      }
    >
      {children}
    </Link>
  );
}

export function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 13v4m-4 3h8m-6.5 0 .5-3h4l.5 3" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4" />
    </svg>
  );
}

export function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16v3H4V7Zm1 3v9h14v-9M10 14h4" />
    </svg>
  );
}

export function MedalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8 3 4 6 4-6M12 21a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-6.5v3" />
    </svg>
  );
}
