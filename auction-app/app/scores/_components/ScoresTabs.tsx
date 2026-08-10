"use client";

import { useMemo, useState } from "react";

import { MatchScoresTable } from "@/app/scores/_components/MatchScoresTable";
import type { GroupStageGw, MatchScoreGroup, MatchScoreSheet } from "@/lib/match-scores/types";

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

  const firstGroup = groups[0];
  return {
    gw: firstGroup?.gw ?? 1,
    slug: firstGroup?.sheets[0]?.slug ?? "",
  };
}

function MatchTabs({
  sheets,
  activeSlug,
  onSelect,
}: {
  sheets: MatchScoreSheet[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {sheets.map((sheet) => {
        const isActive = sheet.slug === activeSlug;
        return (
          <button
            key={sheet.slug}
            type="button"
            onClick={() => onSelect(sheet.slug)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
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
  );
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
  const activeSheet =
    activeGroup?.sheets.find((s) => s.slug === activeSlug) ?? activeGroup?.sheets[0];

  if (!activeGroup || !activeSheet) {
    return <p className="text-sm text-slate-500">No match scores available yet.</p>;
  }

  const handleGroupChange = (gw: GroupStageGw) => {
    setActiveGw(gw);
    const group = groups.find((g) => g.gw === gw);
    const firstSlug = group?.sheets[0]?.slug;
    if (firstSlug) setActiveSlug(firstSlug);
  };

  const returnTo =
    auctionId != null
      ? `/auctions/${auctionId}/match-scores?match=${encodeURIComponent(activeSheet.slug)}`
      : undefined;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {groups.map((group) => (
          <button
            key={group.gw}
            type="button"
            onClick={() => handleGroupChange(group.gw)}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
              activeGw === group.gw
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {group.label}
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              ({group.sheets.length})
            </span>
          </button>
        ))}
      </div>

      <MatchTabs
        sheets={activeGroup.sheets}
        activeSlug={activeSheet.slug}
        onSelect={setActiveSlug}
      />

      <div>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{activeSheet.title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{activeSheet.subtitle}</p>
        {auctionId != null && (
          <p className="mt-1 text-xs text-slate-500">
            Tap a player to open their page in this auction (owner, points, bid history).
          </p>
        )}
      </div>

      <MatchScoresTable
        rows={activeSheet.rows}
        auctionId={auctionId}
        returnTo={returnTo}
      />

      <p className="text-xs text-slate-400">
        Sorted by final score. Keeper units shown per nation.
      </p>
    </div>
  );
}
