import Link from "next/link";
import type { ReactNode } from "react";

/** Manager name that opens their Competitors – Bidding page. */
export function ManagerLink({
  auctionId,
  managerId,
  name,
  className = "",
}: {
  auctionId: number;
  managerId: number | null;
  name: string | null;
  className?: string;
}) {
  const label = name ?? "Unknown";
  if (managerId == null) return <span className={`font-display tracking-[0.01em] ${className}`}>{label}</span>;
  return (
    <Link
      href={`/auctions/${auctionId}/competitors/${managerId}`}
      className={`font-display tracking-[0.01em] underline decoration-current/30 underline-offset-2 hover:decoration-current ${className}`}
    >
      {label}
    </Link>
  );
}

const TONES = {
  buy: { card: "border-emerald-100 to-emerald-50", stripe: "bg-emerald-400", icon: "bg-emerald-500" },
  release: { card: "border-amber-100 to-amber-50", stripe: "bg-amber-400", icon: "bg-amber-500" },
  transfer: { card: "border-sky-100 to-sky-50", stripe: "bg-sky-400", icon: "bg-sky-500" },
  elimination: { card: "border-rose-100 to-rose-50", stripe: "bg-rose-400", icon: "bg-rose-500" },
} as const;

/** Event card: white-to-tint gradient, coloured left stripe and icon by event type. */
export function EventCard({
  tone,
  icon,
  children,
}: {
  tone: keyof typeof TONES;
  icon: ReactNode;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      className={`relative flex gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br from-white via-white py-3.5 pl-5 pr-4 shadow-sm sm:gap-4 sm:py-4 sm:pl-6 sm:pr-5 ${t.card}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${t.stripe}`} />
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${t.icon}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
