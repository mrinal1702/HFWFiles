"use client";

import { useMemo, useState } from "react";

import { ManagerChip } from "@/app/_components/entity/ManagerChip";
import type { StandingEntry, GwInfo } from "@/lib/leaderboard-data";
import { fantasyTeamLabel } from "@/lib/team-name";

interface StandingsTableProps {
  auctionId: number;
  standings: StandingEntry[];
  gameWeeks: GwInfo[];
}

function sumSelectedGws(entry: StandingEntry, selectedGwIds: Set<number>): number {
  let total = 0;
  for (const gwId of selectedGwIds) {
    total += entry.scoresByGwId[String(gwId)] ?? 0;
  }
  return total;
}

function selectionLabel(gameWeeks: GwInfo[], selectedGwIds: Set<number>, selectAll: boolean): string {
  if (selectAll || selectedGwIds.size === gameWeeks.length) {
    return "All gameweeks (season total)";
  }
  if (selectedGwIds.size === 0) return "No gameweeks selected";
  const names = gameWeeks.filter((gw) => selectedGwIds.has(gw.id)).map((gw) => gw.name);
  return names.join(" + ");
}

export function StandingsTable({ auctionId, standings, gameWeeks }: StandingsTableProps) {
  const allGwIds = useMemo(() => new Set(gameWeeks.map((gw) => gw.id)), [gameWeeks]);
  const [selectAll, setSelectAll] = useState(true);
  const [selectedGwIds, setSelectedGwIds] = useState<Set<number>>(() => new Set(allGwIds));

  const effectiveSelectedIds = selectAll ? allGwIds : selectedGwIds;
  const hasScores = gameWeeks.length > 0;

  const displayRows = useMemo(() => {
    return standings
      .map((entry) => ({
        entry,
        filteredPoints: sumSelectedGws(entry, effectiveSelectedIds),
      }))
      .sort((a, b) => {
        if (b.filteredPoints !== a.filteredPoints) return b.filteredPoints - a.filteredPoints;
        const nameA = fantasyTeamLabel(a.entry.teamName, a.entry.name);
        const nameB = fantasyTeamLabel(b.entry.teamName, b.entry.name);
        return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      });
  }, [standings, effectiveSelectedIds]);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedGwIds(new Set(allGwIds));
    }
  };

  const handleGwToggle = (gwId: number, checked: boolean) => {
    const next = new Set(selectedGwIds);
    if (checked) next.add(gwId);
    else next.delete(gwId);

    if (next.size === allGwIds.size) {
      setSelectAll(true);
      setSelectedGwIds(new Set(allGwIds));
      return;
    }

    setSelectAll(false);
    setSelectedGwIds(next);
  };

  if (standings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No participants in this auction yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {hasScores && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Gameweek filter
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="font-medium">Select all</span>
            </label>
            {gameWeeks.map((gw) => (
              <label
                key={gw.id}
                className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={effectiveSelectedIds.has(gw.id)}
                  onChange={(e) => handleGwToggle(gw.id, e.target.checked)}
                  className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>{gw.name}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Showing: {selectionLabel(gameWeeks, effectiveSelectedIds, selectAll)}. Table order
            follows filtered points; Position is overall season rank.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
            <tr>
              <th className="w-8 px-2 py-3" aria-hidden="true" />
              <th className="px-3 py-3 font-semibold">Position</th>
              <th className="px-3 py-3 font-semibold">Team</th>
              <th className="px-3 py-3 text-right font-semibold">Points</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(({ entry, filteredPoints }, idx) => {
              const isLeader = entry.rank === 1;
              const showParticipant = Boolean(entry.teamName?.trim());
              const showPoints = hasScores && effectiveSelectedIds.size > 0;
              const rowIndex = idx + 1;
              const isRelegated = entry.isRelegated;

              return (
                <tr
                  key={entry.userId}
                  className={`border-b ${
                    isRelegated ? "border-red-100 bg-red-100" : "border-slate-100"
                  } ${
                    !isRelegated && idx % 2 === 1 ? "bg-sky-50/40" : !isRelegated ? "bg-white" : ""
                  } ${isLeader && showPoints && !isRelegated ? "font-semibold" : ""}`}
                >
                  <td className="w-8 px-2 py-3 tabular-nums text-slate-400">{rowIndex}</td>
                  <td className="px-3 py-3 tabular-nums text-slate-500">{entry.rank}</td>
                  <td className="px-3 py-3 text-slate-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <ManagerChip
                        auctionId={auctionId}
                        auctionUserId={entry.userId}
                        name={entry.name}
                        teamName={entry.teamName}
                        avatarUrl={entry.avatarUrl}
                        preferTeamLabel
                        labelClassName="font-medium text-slate-900"
                      />
                      {isRelegated && (
                        <span className="rounded border border-red-200 bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800">
                          Relegated
                        </span>
                      )}
                    </div>
                    {showParticipant && (
                      <div className="mt-0.5 pl-6 text-xs font-normal text-slate-500">{entry.name}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {showPoints ? (
                      filteredPoints
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!hasScores && (
          <p className="border-t border-slate-100 px-4 py-4 text-center text-sm text-slate-500">
            No gameweek scores have been published yet. Standings will update once the first
            gameweek is scored.
          </p>
        )}

        {hasScores && effectiveSelectedIds.size === 0 && (
          <p className="border-t border-slate-100 px-4 py-4 text-center text-sm text-slate-500">
            Select at least one gameweek to see points.
          </p>
        )}
      </div>
    </div>
  );
}
