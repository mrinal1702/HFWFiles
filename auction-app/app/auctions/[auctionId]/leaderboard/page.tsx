import { Suspense } from "react";

import { LeaderboardTabs, type LeaderboardTabId } from "@/app/leaderboard/[auctionId]/_components/LeaderboardTabs";
import { getAuthUser } from "@/lib/auth/get-user";
import { fetchAuctionUserNames } from "@/lib/auction-users-query";
import {
  getLeaderboardData,
  getPointsGwContext,
  parseGwSearchParam,
} from "@/lib/leaderboard-data";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function parseTab(value: string | undefined): LeaderboardTabId {
  if (value === "my-points" || value === "competitors" || value === "standings") return value;
  return "standings";
}

async function resolveMyAuctionUserId(auctionId: number, authUserId: string | undefined) {
  if (!authUserId) return null;
  const admin = createAdminClient();
  const users = await fetchAuctionUserNames(admin, auctionId);
  return users.find((u) => u.user_id === authUserId)?.id ?? null;
}

export default async function AuctionLeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ auctionId: string }>;
  searchParams: Promise<{ tab?: string; gw?: string }>;
}) {
  const { auctionId: raw } = await params;
  const { tab: tabParam, gw: gwParam } = await searchParams;
  const auctionId = Number(raw);
  const basePath = `/auctions/${auctionId}/leaderboard`;

  const [authUser, leaderboardData, pointsContext] = await Promise.all([
    getAuthUser(),
    getLeaderboardData(auctionId),
    getPointsGwContext(auctionId, parseGwSearchParam(gwParam)),
  ]);

  const myUserId = await resolveMyAuctionUserId(auctionId, authUser?.id);
  const initialTab = parseTab(tabParam);

  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading leaderboard…</p>}>
      <LeaderboardTabs
        auctionId={auctionId}
        basePath={basePath}
        standings={leaderboardData.standings}
        standingsGameWeeks={leaderboardData.gameWeeks}
        pointsGameWeeks={pointsContext.gameWeeks}
        selectedGw={pointsContext.selectedGw}
        squads={pointsContext.squads}
        myUserId={myUserId}
        initialTab={initialTab}
      />
    </Suspense>
  );
}
