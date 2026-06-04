import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";
import {
  getLeaderboardData,
  getActiveGameWeek,
  getGameweekSquadData,
  getCurrentSquads,
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

  // Try locked snapshot first; fall back to live auction_teams
  const lockedSquads = activeGw ? await getGameweekSquadData(auctionId, activeGw.id) : null;
  const squads = lockedSquads ?? (await getCurrentSquads(auctionId));
  const squadsAreLocked = lockedSquads !== null;

  return (
    <LeaderboardTabs
      standings={standings}
      gameWeeks={gameWeeks}
      activeGw={activeGw}
      squads={squads.length > 0 ? squads : null}
      squadsAreLocked={squadsAreLocked}
      myUserId={d.me?.id ?? null}
    />
  );
}
