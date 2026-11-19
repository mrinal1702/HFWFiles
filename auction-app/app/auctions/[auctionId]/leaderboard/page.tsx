import type { Metadata } from "next";
import { Suspense } from "react";

import { LeaderboardTabs, type LeaderboardTabId } from "@/app/auctions/[auctionId]/leaderboard/_components/LeaderboardTabs";
import { getAuthUser } from "@/lib/auth/get-user";
import {
  getAuctionUserNamesForRequest,
  getLeaderboardData,
  getPointsGwContext,
  parseGwSearchParam,
} from "@/lib/scoring/leaderboard-data";
import { shortGwName } from "@/lib/og/card";
import { loadOgAuctionSummary } from "@/lib/og/auction-summary";

export const dynamic = "force-dynamic";

/** Link-preview text for the standings (the image is ./opengraph-image.tsx). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}): Promise<Metadata> {
  const { auctionId } = await params;
  const s = await loadOgAuctionSummary(Number(auctionId));
  if (!s?.publicView) return {};
  const lb = await getLeaderboardData(s.id);
  const lastGw = lb.gameWeeks.at(-1);
  const leader = lb.standings[0];
  const title = `Standings · ${s.name}`;
  const description =
    lastGw && leader
      ? `${leader.name} leads on ${leader.total} pts after ${shortGwName(lastGw.name)}.`
      : "Standings appear after the first gameweek.";
  return {
    title,
    description,
    openGraph: { siteName: "HFW Fantasy Auction", type: "website", title, description },
  };
}

function parseTab(value: string | undefined): LeaderboardTabId {
  if (value === "my-points" || value === "competitors" || value === "standings") return value;
  return "standings";
}

async function resolveMyAuctionUserId(auctionId: number) {
  const authUser = await getAuthUser();
  if (!authUser) return null;
  const users = await getAuctionUserNamesForRequest(auctionId);
  return users.find((u) => u.user_id === authUser.id)?.id ?? null;
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

  // All independent: run side by side (each piece is shared within this page view).
  const [myUserId, leaderboardData, pointsContext, summary] = await Promise.all([
    resolveMyAuctionUserId(auctionId),
    getLeaderboardData(auctionId),
    getPointsGwContext(auctionId, parseGwSearchParam(gwParam)),
    loadOgAuctionSummary(auctionId),
  ]);
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
        auctionName={summary?.name ?? `Auction #${auctionId}`}
      />
    </Suspense>
  );
}
