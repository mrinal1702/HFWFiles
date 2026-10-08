"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  initiationDeadlineAt: string | null;
  raiseDeadlineAt: string | null;
  hardDeadlineAt: string | null;
};

function formatDeadline(iso: string | null): string {
  if (!iso) return "not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // en-GB gives unambiguous "4 June 2026, 10:00 pm" regardless of the viewer's locale
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isPast(iso: string | null): boolean {
  if (!iso) return false;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && Date.now() >= ms;
}

function DeadlineRow({
  label,
  iso,
  past,
  next,
}: {
  label: string;
  iso: string | null;
  past: boolean;
  /** The next deadline still to come — highlighted. */
  next: boolean;
}) {
  const tone = past
    ? "border-amber-200 bg-amber-50/70"
    : next
      ? "border-sky-300 bg-gradient-to-br from-white to-sky-50 shadow-sm shadow-sky-100"
      : "border-sky-100 bg-white";
  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-xl border px-3 py-2 max-sm:flex max-sm:items-baseline max-sm:justify-between max-sm:gap-3 ${tone}`}
    >
      {next && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-sky-400 to-sky-600" />}
      <dt
        className={`shrink-0 text-[11px] font-semibold uppercase tracking-wide ${
          past ? "text-amber-700" : next ? "text-sky-700" : "text-slate-500"
        }`}
      >
        {label}
      </dt>
      <dd className={`text-right text-slate-800 sm:mt-0.5 sm:text-left ${past ? "text-amber-800" : ""}`}>
        <span className={next ? "font-semibold" : "font-medium"}>{formatDeadline(iso)}</span>
        {past && <span className="ml-1 text-xs">(passed)</span>}
      </dd>
    </div>
  );
}

export function AuctionDeadlines({ initiationDeadlineAt, raiseDeadlineAt, hardDeadlineAt }: Props) {
  const router = useRouter();

  useEffect(() => {
    const deadlines = [initiationDeadlineAt, raiseDeadlineAt, hardDeadlineAt];
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const ts of deadlines) {
      if (!ts) continue;
      const ms = Date.parse(ts) - Date.now();
      if (ms <= 0) continue;
      timers.push(setTimeout(() => router.refresh(), ms));
    }

    return () => timers.forEach(clearTimeout);
  }, [initiationDeadlineAt, raiseDeadlineAt, hardDeadlineAt, router]);

  const initiationPast = isPast(initiationDeadlineAt);
  const raisePast = isPast(raiseDeadlineAt);
  const hardPast = isPast(hardDeadlineAt);

  return (
    <div className="w-full min-w-0 space-y-2">
      {/*
        Mobile: full-width tiles with label left / date right. sm+: three tiles side by side
        (label above date). The next deadline still to come is highlighted.
      */}
      <dl className="grid w-full grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <DeadlineRow
          label="Initiation deadline"
          iso={initiationDeadlineAt}
          past={initiationPast}
          next={!initiationPast && !!initiationDeadlineAt}
        />
        <DeadlineRow
          label="Raise deadline"
          iso={raiseDeadlineAt}
          past={raisePast}
          next={initiationPast && !raisePast && !!raiseDeadlineAt}
        />
        <DeadlineRow
          label="Hard deadline"
          iso={hardDeadlineAt}
          past={hardPast}
          next={raisePast && !hardPast && !!hardDeadlineAt}
        />
      </dl>

      {initiationPast && !raisePast && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          <span className="font-semibold">Initiation closed.</span> Players with no bids can no longer
          be opened — you can only raise on players already in play.
        </p>
      )}
      {raisePast && !hardPast && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <span className="font-semibold">Raise mode active.</span> Every bid must increase the
          current high by at least 5.
        </p>
      )}
    </div>
  );
}
