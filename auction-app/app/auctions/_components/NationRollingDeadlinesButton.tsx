"use client";

import { useEffect, useId, useRef, useState } from "react";

import { LocalTime } from "@/app/auctions/_components/LocalTime";
import type { NationDeadlineRow } from "@/lib/nation-deadlines-data";

type Props = {
  deadlines: NationDeadlineRow[];
  finalHardDeadlineAt: string | null;
};

function isPast(iso: string): boolean {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && Date.now() >= ms;
}

export function NationRollingDeadlinesButton({ deadlines, finalHardDeadlineAt }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    function onPointerDown(e: MouseEvent) {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-900 shadow-sm hover:bg-sky-100 active:bg-sky-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M4.5 2A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 11.5 2h-7ZM5 4.75A.75.75 0 0 1 5.75 4h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 5 4.75ZM5.75 7a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5ZM5 10.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"
            clipRule="evenodd"
          />
        </svg>
        Deadlines
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Nation bidding deadlines"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg sm:w-[26rem]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Rolling deadlines</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Per nation — times in your local timezone. After a nation&apos;s hard deadline, its players
                lock in your squad and bidding on them stops.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {finalHardDeadlineAt && (
            <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <span className="font-semibold">Final window close:</span>{" "}
              <LocalTime iso={finalHardDeadlineAt} />
            </p>
          )}

          <ul className="mt-3 max-h-[min(60vh,20rem)] space-y-3 overflow-y-auto">
            {deadlines.map((row) => {
              const raisePast = isPast(row.raiseDeadlineAt);
              const hardPast = isPast(row.hardDeadlineAt);
              return (
                <li
                  key={row.teamName}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm"
                >
                  <div className="font-semibold text-slate-900">{row.teamName}</div>
                  <dl className="mt-2 space-y-1.5 text-xs">
                    <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
                      <dt className="text-slate-600">Raise by +5 from</dt>
                      <dd className={raisePast ? "font-medium text-amber-800" : "text-slate-800"}>
                        <LocalTime iso={row.raiseDeadlineAt} />
                        {raisePast && <span className="ml-1">(passed)</span>}
                      </dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
                      <dt className="text-slate-600">Hard deadline (lots close)</dt>
                      <dd className={hardPast ? "font-medium text-amber-800" : "text-slate-800"}>
                        <LocalTime iso={row.hardDeadlineAt} />
                        {hardPast && <span className="ml-1">(passed)</span>}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
