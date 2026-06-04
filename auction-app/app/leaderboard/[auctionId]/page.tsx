import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";
import {
  getLeaderboardData,
  getActiveGameWeek,
  getGameweekSquadData,
} from "@/lib/leaderboard-data";
import { LeaderboardTabs } from "./_components/LeaderboardTabs";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);

  const [d, { standings, gameWeeks }, activeGw] = await Promise.all([
    loadAuctionDashboardForViewer(auctionId),
    getLeaderboardData(auctionId),
    getActiveGameWeek(),
  ]);

  const squads = activeGw ? await getGameweekSquadData(auctionId, activeGw.id) : null;

  return (
    <LeaderboardTabs
      standings={standings}
      gameWeeks={gameWeeks}
      activeGw={activeGw}
      squads={squads}
      myUserId={d.me?.id ?? null}
    />
  );
}
