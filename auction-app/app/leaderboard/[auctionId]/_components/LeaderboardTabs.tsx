"use client";

import type { StandingEntry, GwInfo } from "@/lib/leaderboard-data";
import { StandingsTable } from "./StandingsTable";

interface LeaderboardTabsProps {
  auctionId: number;
  standings: StandingEntry[];
  gameWeeks: GwInfo[];
}

export function LeaderboardTabs({ auctionId, standings, gameWeeks }: LeaderboardTabsProps) {
  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1">
        <span className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm">
          Standings
        </span>
      </div>

      <StandingsTable auctionId={auctionId} standings={standings} gameWeeks={gameWeeks} />
    </div>
  );
}
