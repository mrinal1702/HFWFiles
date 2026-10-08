"use client";

import { useMemo, useState } from "react";

import { MatchScoresTable } from "@/app/scores/_components/MatchScoresTable";
import type { GroupStageGw, MatchScoreGroup } from "@/lib/scoring/match-scores/types";

/** Gameweek + match from a ?match= deep link; otherwise the first gameweek and no match. */
function resolveInitialSelection(
  groups: MatchScoreGroup[],
  initialSlug?: string,
): { gw: GroupStageGw; slug: string } {
  if (initialSlug) {
    for (const group of groups) {
      const sheet = group.sheets.find((s) => s.slug === initialSlug);
      if (sheet) return { gw: group.gw, slug: sheet.slug };
    }
  }
  return { gw: groups[0]?.gw ?? 1, slug: "" };
}

export function ScoresTabs({
  groups,
  initialSlug,
  auctionId,
}: {
  groups: MatchScoreGroup[];
  initialSlug?: string;
  /** When set, player names link into this auction's player pages. */
  auctionId?: number;
}) {
  const initial = useMemo(
    () => resolveInitialSelection(groups, initialSlug),
    [groups, initialSlug],
  );

  const [activeGw, setActiveGw] = useState<GroupStageGw>(initial.gw);
  const [activeSlug, setActiveSlug] = useState(initial.slug);

  const activeGroup = groups.find((g) => g.gw === activeGw) ?? groups[0];
  const activeSheet = activeGroup?.sheets.find((s) => s.slug === activeSlug) ?? null;

  if (!activeGroup) {
    return <p className="text-sm text-slate-500">No match scores available yet.</p>;
  }

  const returnTo =
    auctionId != null && activeSheet
      ? `/auctions/${auctionId}/match-scores?match=${encodeURIComponent(activeSheet.slug)}`
      : undefined;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Gameweek tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-sky-100 bg-sky-50/60 p-1">
        {groups.map((group) => (
          <button
            key={group.gw}
            type="button"
            onClick={() => {
              setActiveGw(group.gw);
              setActiveSlug("");
            }}
            className={`flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
              activeGw === group.gw
                ? "bg-gradient-to-r from-sky-500 to-sky-700 text-white shadow-sm shadow-sky-200"
                : "text-slate-700 hover:bg-white hover:text-sky-800"
            }`}
          >
            {group.label}
            <span className={`ml-1.5 text-xs font-normal ${activeGw === group.gw ? "text-sky-100" : "text-slate-400"}`}>
              ({group.sheets.length})
            </span>
          </button>
        ))}
      </div>

      {activeGroup.sheets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sky-200 bg-white px-4 py-10 text-center text-sm text-slate-600">
          No matches scored yet for {activeGroup.label}. Check back once the gameweek completes.
        </p>
      ) : (
        <label className="block">
          <span className="sr-only">Choose a match</span>
          <select
            value={activeSlug}
            onChange={(e) => setActiveSlug(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-base font-medium text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 sm:max-w-md sm:text-sm"
          >
            <option value="">Select a match…</option>
            {/* Alternating shading: shown by Chrome/Edge/Firefox on Windows; macOS and phones use native pickers. */}
            {activeGroup.sheets.map((sheet, i) => (
              <option
                key={sheet.slug}
                value={sheet.slug}
                className={i % 2 === 0 ? "bg-white text-slate-900" : "bg-slate-100 text-slate-900"}
              >
                {sheet.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {activeSheet && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{activeSheet.title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{activeSheet.subtitle}</p>
          </div>

          <MatchScoresTable rows={activeSheet.rows} auctionId={auctionId} returnTo={returnTo} />

          <p className="text-xs text-slate-400">
            Sorted by score (highest first). Keeper units shown per club.
          </p>
        </>
      )}
    </div>
  );
}
