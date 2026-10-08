import { notFound } from "next/navigation";

import { GwPointsView } from "@/app/auctions/[auctionId]/leaderboard/_components/GwPointsView";
import { fetchAuctionUserNames } from "@/lib/auction-users-query";
import {
  getLeaderboardData,
  getPointsGwContext,
  parseGwSearchParam,
} from "@/lib/scoring/leaderboard-data";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function LeaderboardCompetitorPointsPage({
  params,
  searchParams,
}: {
  params: Promise<{ auctionId: string; auctionUserId: string }>;
  searchParams: Promise<{ gw?: string; from?: string }>;
}) {
  const { auctionId: aRaw, auctionUserId: uRaw } = await params;
  const { gw: gwParam, from } = await searchParams;
  const auctionId = Number(aRaw);
  const competitorUserId = Number(uRaw);
  if (!Number.isFinite(auctionId) || auctionId <= 0 || !Number.isFinite(competitorUserId)) {
    notFound();
  }

  const admin = createAdminClient();
  const users = await fetchAuctionUserNames(admin, auctionId);
  if (!users.some((u) => u.id === competitorUserId)) {
    notFound();
  }

  const [leaderboardData, pointsContext] = await Promise.all([
    getLeaderboardData(auctionId),
    getPointsGwContext(auctionId, parseGwSearchParam(gwParam)),
  ]);

  const squad = pointsContext.squads?.find((p) => p.userId === competitorUserId) ?? null;
  const seasonEntry = leaderboardData.standings.find((s) => s.userId === competitorUserId);
  const seasonTotal =
    seasonEntry && (seasonEntry.total !== 0 || Object.keys(seasonEntry.scoresByGwId).length > 0)
      ? seasonEntry.total
      : null;

  const basePath = `/auctions/${auctionId}/leaderboard/competitors/${competitorUserId}`;
  const gwQs = gwParam ? `&gw=${encodeURIComponent(gwParam)}` : "";
  const fromStandings = from === "standings";
  const backHref = fromStandings
    ? `/auctions/${auctionId}/leaderboard`
    : `/auctions/${auctionId}/leaderboard?tab=competitors${gwQs}`;

  return (
    <section className="space-y-4 sm:space-y-5">
      <GwPointsView
        auctionId={auctionId}
        squad={squad}
        gameWeeks={pointsContext.gameWeeks}
        selectedGw={pointsContext.selectedGw}
        seasonTotal={seasonTotal}
        basePath={basePath}
        backHref={backHref}
        backLabel={fromStandings ? "← Standings" : "← Competitors – Points"}
      />
    </section>
  );
}
