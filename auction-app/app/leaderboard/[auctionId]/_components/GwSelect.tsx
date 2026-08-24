"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import type { GwInfo } from "@/lib/leaderboard-data";

interface GwSelectProps {
  gameWeeks: GwInfo[];
  selectedGwId: number | null;
  /** Path without query, e.g. `/leaderboard/9`. */
  basePath: string;
}

export function GwSelect({ gameWeeks, selectedGwId, basePath }: GwSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("gw", value);
      else params.delete("gw");
      const qs = params.toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [basePath, router, searchParams],
  );

  if (gameWeeks.length === 0) return null;

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
      <span className="font-medium text-slate-600">Gameweek</span>
      <select
        value={selectedGwId != null ? String(selectedGwId) : ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      >
        {gameWeeks.map((gw) => (
          <option key={gw.id} value={gw.id}>
            {gw.name}
          </option>
        ))}
      </select>
    </label>
  );
}
