"use client";

import { useEffect, useId, useState } from "react";

import type { AuctionMatchweek } from "@/lib/auction-fixtures";

type Props = {
  matchweeks: AuctionMatchweek[];
  /** Visual style to match side-menu items */
  className?: string;
};

export function FixturesModalButton({ matchweeks, className }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "shrink-0 rounded-md px-3 py-2.5 text-sm font-medium leading-tight text-slate-700 hover:bg-sky-50 hover:text-sky-900 sm:py-2"
        }
      >
        Fixtures
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[min(92vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                  Auction fixtures
                </h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  Premier League 2026/27 · Matchweeks 1–4 · kick-offs UK time
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close fixtures"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <div className="space-y-6">
                {matchweeks.map((mw) => (
                  <section key={mw.week} aria-labelledby={`mw-${mw.week}-heading`}>
                    <h3
                      id={`mw-${mw.week}-heading`}
                      className="sticky top-0 z-10 -mx-1 mb-2 bg-white/95 px-1 py-1 text-sm font-semibold text-slate-900 backdrop-blur-sm"
                    >
                      {mw.label}
                    </h3>
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {mw.fixtures.map((f, i) => (
                        <li
                          key={`${mw.week}-${f.home}-${f.away}-${i}`}
                          className="flex flex-col gap-0.5 px-3 py-2.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
                        >
                          <div className="min-w-0 font-medium text-slate-900">
                            {f.home}{" "}
                            <span className="font-normal text-slate-500">v</span> {f.away}
                          </div>
                          <div className="shrink-0 tabular-nums text-slate-600">
                            {f.dateLabel} · {f.kickoff}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
