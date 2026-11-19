import { notFound } from "next/navigation";

import { GwPointsView } from "@/app/auctions/[auctionId]/leaderboard/_components/GwPointsView";
import {
  getAuctionUserNamesForRequest,
  getLeaderboardData,
  getPointsGwContext,
  parseGwSearchParam,
} from "@/lib/scoring/leaderboard-data";
import { loadOgAuctionSummary } from "@/lib/og/auction-summary";
import { shortGwName } from "@/lib/og/gw-name";
import { fantasyTeamLabel } from "@/lib/team-name";

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

  // All independent: run side by side (each piece is shared within this page view).
  const [users, leaderboardData, pointsContext, summary] = await Promise.all([
    getAuctionUserNamesForRequest(auctionId),
    getLeaderboardData(auctionId),
    getPointsGwContext(auctionId, parseGwSearchParam(gwParam)),
    loadOgAuctionSummary(auctionId),
  ]);
  if (!users.some((u) => u.id === competitorUserId)) {
    notFound();
  }

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
        share={
          squad && pointsContext.selectedGw
            ? {
                path: `${basePath}?gw=${pointsContext.selectedGw.id}`,
                title: `${fantasyTeamLabel(squad.teamName, squad.name)} · ${shortGwName(pointsContext.selectedGw.name)}`,
                text: `${fantasyTeamLabel(squad.teamName, squad.name)}: ${shortGwName(pointsContext.selectedGw.name)} points · ${summary?.name ?? `Auction #${auctionId}`}`,
              }
            : undefined
        }
      />
    </section>
  );
}
