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
    <div className="space-y-2">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div className="flex items-baseline gap-2">
          <dt className="shrink-0 font-medium text-slate-600">Initiation deadline</dt>
          <dd className={initiationPast ? "text-amber-700 font-medium" : "text-slate-700"}>
            {formatDeadline(initiationDeadlineAt)}
            {initiationPast && <span className="ml-1 text-xs">(passed)</span>}
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="shrink-0 font-medium text-slate-600">Raise deadline</dt>
          <dd className={raisePast ? "text-amber-700 font-medium" : "text-slate-700"}>
            {formatDeadline(raiseDeadlineAt)}
            {raisePast && <span className="ml-1 text-xs">(passed)</span>}
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="shrink-0 font-medium text-slate-600">Hard deadline</dt>
          <dd className={hardPast ? "text-amber-700 font-medium" : "text-slate-700"}>
            {formatDeadline(hardDeadlineAt)}
            {hardPast && <span className="ml-1 text-xs">(passed)</span>}
          </dd>
        </div>
      </dl>

      {initiationPast && !raisePast && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          <span className="font-semibold">Initiation closed.</span> Players with no bids can no longer be opened — you can only raise on players already in play.
        </p>
      )}
      {raisePast && !hardPast && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <span className="font-semibold">Raise mode active.</span> Every bid must increase the current high by at least 5.
        </p>
      )}
    </div>
  );
}
