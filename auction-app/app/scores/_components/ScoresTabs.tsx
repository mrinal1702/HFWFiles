"use client";

import { useMemo, useState } from "react";

import { MatchScoresTable } from "@/app/scores/_components/MatchScoresTable";
import type { MatchScoreSheet } from "@/lib/match-scores/types";

export function ScoresTabs({
  sheets,
  initialSlug,
}: {
  sheets: MatchScoreSheet[];
  initialSlug?: string;
}) {
  const defaultSlug = useMemo(() => {
    if (initialSlug && sheets.some((s) => s.slug === initialSlug)) return initialSlug;
    return sheets[0]?.slug ?? "";
  }, [initialSlug, sheets]);

  const [activeSlug, setActiveSlug] = useState(defaultSlug);
  const activeSheet = sheets.find((s) => s.slug === activeSlug) ?? sheets[0];

  if (!activeSheet) {
    return (
      <p className="text-sm text-slate-500">No match scores available yet.</p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {sheets.map((sheet) => {
          const isActive = sheet.slug === activeSlug;
          return (
            <button
              key={sheet.slug}
              type="button"
              onClick={() => setActiveSlug(sheet.slug)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-sky-300 bg-sky-50 text-sky-900 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {sheet.title}
            </button>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{activeSheet.title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{activeSheet.subtitle}</p>
      </div>

      <MatchScoresTable rows={activeSheet.rows} />

      <p className="text-xs text-slate-400">
        Sorted by final score. Keeper units shown per nation.
      </p>
    </div>
  );
}
