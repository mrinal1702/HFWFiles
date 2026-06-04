"use client";

import { useState } from "react";
import type { StandingEntry, GwInfo, ParticipantGwSquad } from "@/lib/leaderboard-data";
import { StandingsTable } from "./StandingsTable";
import { GameweekSquadView } from "./GameweekSquadView";

type TabId = "standings" | "this-gameweek";

interface LeaderboardTabsProps {
  standings: StandingEntry[];
  gameWeeks: GwInfo[];
  activeGw: GwInfo | null;
  squads: ParticipantGwSquad[] | null;
  myUserId: number | null;
}

export function LeaderboardTabs({
  standings,
  gameWeeks,
  activeGw,
  squads,
  myUserId,
}: LeaderboardTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("standings");

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "standings", label: "Standings" },
    {
      id: "this-gameweek",
      label: activeGw ? `This Gameweek · ${activeGw.name}` : "This Gameweek",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-tab bar */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "standings" && (
        <StandingsTable standings={standings} gameWeeks={gameWeeks} />
      )}

      {activeTab === "this-gameweek" && (
        <GameweekSquadView activeGw={activeGw} squads={squads} myUserId={myUserId} />
      )}
    </div>
  );
}
