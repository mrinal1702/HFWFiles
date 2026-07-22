"use client";

import { useState } from "react";
import type { StandingEntry, GwInfo, GameweekPanel } from "@/lib/leaderboard-data";
import { StandingsTable } from "./StandingsTable";
import { GameweekSquadView } from "./GameweekSquadView";

type TabId = "standings" | `gw-${number}`;

interface LeaderboardTabsProps {
  auctionId: number;
  standings: StandingEntry[];
  gameWeeks: GwInfo[];
  activeGw: GwInfo | null;
  gameweekPanels: GameweekPanel[];
  myUserId: number | null;
}

export function LeaderboardTabs({
  auctionId,
  standings,
  gameWeeks,
  activeGw,
  gameweekPanels,
  myUserId,
}: LeaderboardTabsProps) {
  const defaultTab: TabId = activeGw ? `gw-${activeGw.id}` : "standings";
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "standings", label: "Standings" },
    ...gameweekPanels.map((panel) => ({
      id: `gw-${panel.gw.id}` as TabId,
      label: panel.gw.name,
    })),
  ];

  const selectedPanel =
    activeTab === "standings"
      ? null
      : gameweekPanels.find((panel) => activeTab === `gw-${panel.gw.id}`) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            } ${tab.id === "standings" ? "flex-none" : "flex-1 min-w-[8rem]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "standings" && (
        <StandingsTable auctionId={auctionId} standings={standings} gameWeeks={gameWeeks} />
      )}

      {selectedPanel && (
        <GameweekSquadView
          auctionId={auctionId}
          activeGw={selectedPanel.gw}
          squads={selectedPanel.squads}
          squadsAreLocked={selectedPanel.squadsAreLocked}
          myUserId={myUserId}
        />
      )}
    </div>
  );
}
