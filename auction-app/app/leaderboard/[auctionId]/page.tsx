import { Suspense } from "react";

import { getAuthUser } from "@/lib/auth/get-user";
import { fetchAuctionUserNames } from "@/lib/auction-users-query";
import { getLeaderboardData, getParticipantsOwnedPoints } from "@/lib/leaderboard-data";
import { createAdminClient } from "@/lib/supabase-server";

import { LeaderboardTabs, type LeaderboardTabId } from "./_components/LeaderboardTabs";

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

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ auctionId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { auctionId: raw } = await params;
  const { tab: tabParam } = await searchParams;
  const auctionId = Number(raw);

  const [authUser, leaderboardData, ownedPointsData] = await Promise.all([
    getAuthUser(),
    getLeaderboardData(auctionId),
    getParticipantsOwnedPoints(auctionId),
  ]);

  const myUserId = await resolveMyAuctionUserId(auctionId, authUser?.id);
  const initialTab = parseTab(tabParam);

  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading leaderboard…</p>}>
      <LeaderboardTabs
        auctionId={auctionId}
        standings={leaderboardData.standings}
        gameWeeks={leaderboardData.gameWeeks}
        ownedPointsParticipants={ownedPointsData.participants}
        ownedPointsGameWeeks={ownedPointsData.gameWeeks}
        myUserId={myUserId}
        initialTab={initialTab}
      />
    </Suspense>
  );
}
