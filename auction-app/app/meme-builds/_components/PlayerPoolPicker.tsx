"use client";

import { useMemo, useState } from "react";
import { formatListedPosition, listedPositionSortKey } from "@/lib/best-xi-display";
import type { MemeBuildPoolPlayer } from "@/lib/meme-builds/types";

type PositionFilter = "all" | "gk" | "def" | "mid" | "fwd";

function matchesPositionFilter(position: string | null, filter: PositionFilter): boolean {
  if (filter === "all") return true;
  const label = formatListedPosition(position);
  if (filter === "gk") return label === "GK";
  if (filter === "def") return label === "DEF";
  if (filter === "mid") return label === "MID";
  if (filter === "fwd") return label === "FWD";
  return true;
}

interface PlayerPoolPickerProps {
  pool: MemeBuildPoolPlayer[];
  squadPlayerIds: Set<string>;
  onAdd: (playerId: string) => void;
}

export function PlayerPoolPicker({ pool, squadPlayerIds, onAdd }: PlayerPoolPickerProps) {
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("all");
  const [countryFilter, setCountryFilter] = useState("all");

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const p of pool) {
      if (p.country?.trim()) set.add(p.country.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [pool]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pool
      .filter((p) => {
        if (squadPlayerIds.has(p.playerId)) return false;
        if (!matchesPositionFilter(p.position, positionFilter)) return false;
        if (countryFilter !== "all" && p.country !== countryFilter) return false;
        if (!q) return true;
        const name = (p.playerName ?? "").toLowerCase();
        const country = (p.country ?? "").toLowerCase();
        return name.includes(q) || country.includes(q) || p.playerId.includes(q);
      })
      .sort((a, b) => {
        const pa = listedPositionSortKey(a.position);
        const pb = listedPositionSortKey(b.position);
        if (pa !== pb) return pa - pb;
        return (a.playerName ?? "").localeCompare(b.playerName ?? "");
      });
  }, [pool, squadPlayerIds, search, positionFilter, countryFilter]);

  const shown = filtered.slice(0, 80);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Add players</h3>
      <p className="mt-1 text-xs text-slate-500">
        Search the full World Cup pool. Showing up to 80 matches — narrow filters to find players.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 sm:col-span-1"
        />
        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value as PositionFilter)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">All positions</option>
          <option value="gk">Goalkeepers</option>
          <option value="def">Defenders</option>
          <option value="mid">Midfielders</option>
          <option value="fwd">Forwards</option>
        </select>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-3 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
        {shown.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-slate-500">No players match your filters.</li>
        ) : (
          shown.map((p) => (
            <li key={p.playerId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-900">{p.playerName ?? "—"}</div>
                <div className="truncate text-xs text-slate-500">
                  {formatListedPosition(p.position) ?? "—"} · {p.country ?? "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onAdd(p.playerId)}
                className="shrink-0 rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700"
              >
                Add
              </button>
            </li>
          ))
        )}
      </ul>
      {filtered.length > 80 && (
        <p className="mt-2 text-xs text-slate-500">
          {filtered.length - 80} more players hidden — refine your search.
        </p>
      )}
    </div>
  );
}
