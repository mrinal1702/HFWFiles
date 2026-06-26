"use client";

import { useMemo, useState } from "react";
import type { MemeBuildGwInfo } from "@/lib/meme-builds/types";
import type { MemeBuildStandingRow } from "@/lib/meme-builds/scoring";

interface MemeStandingsTableProps {
  standings: MemeBuildStandingRow[];
  gameWeeks: MemeBuildGwInfo[];
}

function sumSelectedGws(entry: MemeBuildStandingRow, selectedGwIds: Set<number>): number {
  let total = 0;
  for (const gwId of selectedGwIds) {
    total += entry.scoresByGwId[String(gwId)] ?? 0;
  }
  return total;
}

export function MemeStandingsTable({ standings, gameWeeks }: MemeStandingsTableProps) {
  const allGwIds = useMemo(() => new Set(gameWeeks.map((gw) => gw.id)), [gameWeeks]);
  const [selectAll, setSelectAll] = useState(true);
  const [selectedGwIds, setSelectedGwIds] = useState<Set<number>>(() => new Set(allGwIds));

  const effectiveSelectedIds = selectAll ? allGwIds : selectedGwIds;

  const displayRows = useMemo(() => {
    return standings
      .map((entry) => ({
        entry,
        filteredPoints: sumSelectedGws(entry, effectiveSelectedIds),
      }))
      .sort((a, b) => {
        if (b.filteredPoints !== a.filteredPoints) return b.filteredPoints - a.filteredPoints;
        return a.entry.name.localeCompare(b.entry.name, undefined, { sensitivity: "base" });
      });
  }, [standings, effectiveSelectedIds]);

  if (standings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Create a meme build to see standings here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Gameweek filter
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={(e) => {
                setSelectAll(e.target.checked);
                if (e.target.checked) setSelectedGwIds(new Set(allGwIds));
              }}
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
                onChange={(e) => {
                  const next = new Set(selectedGwIds);
                  if (e.target.checked) next.add(gw.id);
                  else next.delete(gw.id);
                  if (next.size === allGwIds.size) {
                    setSelectAll(true);
                    setSelectedGwIds(new Set(allGwIds));
                  } else {
                    setSelectAll(false);
                    setSelectedGwIds(next);
                  }
                }}
                className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span>{gw.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
            <tr>
              <th className="w-8 px-2 py-3" aria-hidden="true" />
              <th className="px-3 py-3 font-semibold">Build</th>
              <th className="px-3 py-3 text-right font-semibold">Points</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(({ entry, filteredPoints }, idx) => (
              <tr
                key={entry.buildId}
                className={`border-b border-slate-100 ${idx % 2 === 1 ? "bg-sky-50/40" : "bg-white"}`}
              >
                <td className="w-8 px-2 py-3 tabular-nums text-slate-400">{idx + 1}</td>
                <td className="px-3 py-3 font-medium text-slate-900">{entry.name}</td>
                <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                  {effectiveSelectedIds.size > 0 ? filteredPoints : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
