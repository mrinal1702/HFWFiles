"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { GwInfo, ParticipantGwSquad, StandingEntry } from "@/lib/leaderboard-data";

import { CompetitorsPointsList, type CompetitorListEntry } from "./CompetitorsPointsList";
import { GwPointsView } from "./GwPointsView";
import { GwSelect } from "./GwSelect";
import { StandingsTable } from "./StandingsTable";

export type LeaderboardTabId = "standings" | "my-points" | "competitors";

const TABS: Array<{ id: LeaderboardTabId; label: string }> = [
  { id: "standings", label: "Standings" },
  { id: "my-points", label: "My Points" },
  { id: "competitors", label: "Competitors" },
];

function parseTab(value: string | null | undefined): LeaderboardTabId {
  if (value === "my-points" || value === "competitors" || value === "standings") return value;
  return "standings";
}

function seasonTotalForUser(standings: StandingEntry[], userId: number): number | null {
  const entry = standings.find((s) => s.userId === userId);
  if (!entry) return null;
  if (entry.total === 0 && Object.keys(entry.scoresByGwId).length === 0) return null;
  return entry.total;
}

interface LeaderboardTabsProps {
  auctionId: number;
  /** Route prefix for tab/gw query updates (e.g. `/auctions/9/leaderboard`). */
  basePath: string;
  standings: StandingEntry[];
  standingsGameWeeks: GwInfo[];
  pointsGameWeeks: GwInfo[];
  selectedGw: GwInfo | null;
  squads: ParticipantGwSquad[] | null;
  myUserId: number | null;
  initialTab: LeaderboardTabId;
}

export function LeaderboardTabs({
  auctionId,
  basePath,
  standings,
  standingsGameWeeks,
  pointsGameWeeks,
  selectedGw,
  squads,
  myUserId,
  initialTab,
}: LeaderboardTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab") ?? initialTab);

  const mySquad = useMemo(
    () => squads?.find((s) => s.userId === myUserId) ?? null,
    [squads, myUserId],
  );

  const competitorRows: CompetitorListEntry[] = useMemo(() => {
    return standings.map((entry) => {
      return {
        userId: entry.userId,
        name: entry.name,
        teamName: entry.teamName,
        avatarUrl: entry.avatarUrl,
        seasonTotal: seasonTotalForUser(standings, entry.userId),
      };
    });
  }, [standings]);

  const setTab = useCallback(
    (tab: LeaderboardTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "standings") params.delete("tab");
      else params.set("tab", tab);
      const qs = params.toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [basePath, router, searchParams],
  );

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1">
        {TABS.map(({ id, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === "standings" && (
        <StandingsTable auctionId={auctionId} standings={standings} gameWeeks={standingsGameWeeks} />
      )}

      {activeTab === "my-points" && (
        <>
          {myUserId == null ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Sign in with an account linked to this auction to see your points.
            </p>
          ) : (
            <GwPointsView
              auctionId={auctionId}
              squad={mySquad}
              gameWeeks={pointsGameWeeks}
              selectedGw={selectedGw}
              seasonTotal={seasonTotalForUser(standings, myUserId)}
              basePath={basePath}
            />
          )}
        </>
      )}

      {activeTab === "competitors" && (
        <div className="space-y-4">
          <GwSelect
            gameWeeks={pointsGameWeeks}
            selectedGwId={selectedGw?.id ?? null}
            basePath={basePath}
          />
          <CompetitorsPointsList
            auctionId={auctionId}
            participants={competitorRows}
            gwQuery={searchParams.get("gw")}
          />
        </div>
      )}
    </div>
  );
}
