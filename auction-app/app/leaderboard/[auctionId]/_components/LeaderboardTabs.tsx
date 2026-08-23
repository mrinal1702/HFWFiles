"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type {
  GwInfo,
  ParticipantOwnedPoints,
  StandingEntry,
} from "@/lib/leaderboard-data";

import { CompetitorsPointsList } from "./CompetitorsPointsList";
import { OwnedPointsView } from "./OwnedPointsView";
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

interface LeaderboardTabsProps {
  auctionId: number;
  standings: StandingEntry[];
  gameWeeks: GwInfo[];
  ownedPointsParticipants: ParticipantOwnedPoints[];
  ownedPointsGameWeeks: GwInfo[];
  myUserId: number | null;
  initialTab: LeaderboardTabId;
}

export function LeaderboardTabs({
  auctionId,
  standings,
  gameWeeks,
  ownedPointsParticipants,
  ownedPointsGameWeeks,
  myUserId,
  initialTab,
}: LeaderboardTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab") ?? initialTab);

  const myPoints = useMemo(
    () => ownedPointsParticipants.find((p) => p.userId === myUserId) ?? null,
    [ownedPointsParticipants, myUserId],
  );

  const setTab = useCallback(
    (tab: LeaderboardTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "standings") params.delete("tab");
      else params.set("tab", tab);
      const qs = params.toString();
      router.replace(qs ? `/leaderboard/${auctionId}?${qs}` : `/leaderboard/${auctionId}`, {
        scroll: false,
      });
    },
    [auctionId, router, searchParams],
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
        <StandingsTable auctionId={auctionId} standings={standings} gameWeeks={gameWeeks} />
      )}

      {activeTab === "my-points" && (
        <>
          {myUserId == null ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Sign in with an account linked to this auction to see your points.
            </p>
          ) : myPoints ? (
            <OwnedPointsView
              auctionId={auctionId}
              participant={myPoints}
              gameWeeks={ownedPointsGameWeeks}
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              You are not registered as a manager in this auction.
            </p>
          )}
        </>
      )}

      {activeTab === "competitors" && (
        <CompetitorsPointsList auctionId={auctionId} participants={ownedPointsParticipants} />
      )}
    </div>
  );
}
