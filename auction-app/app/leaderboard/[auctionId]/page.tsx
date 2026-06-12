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

  // Hard deadline determines whether squads are "locked"
  const hardDeadlineAt = d.auction?.hard_deadline_at;
  const hardDeadlinePassed = hardDeadlineAt
    ? Date.now() >= Date.parse(hardDeadlineAt)
    : false;

  // Priority: formal snapshot → live auction_teams (only if deadline passed) → null
  const lockedSquads = activeGw ? await getGameweekSquadData(auctionId, activeGw.id) : null;
  let squads: Awaited<ReturnType<typeof getCurrentSquads>> | null = null;
  if (lockedSquads) {
    squads = lockedSquads;
  } else if (hardDeadlinePassed) {
    const current = await getCurrentSquads(auctionId, activeGw?.id);
    squads = current.length > 0 ? current : null;
  }

  return (
    <LeaderboardTabs
      standings={standings}
      gameWeeks={gameWeeks}
      activeGw={activeGw}
      squads={squads}
      squadsAreLocked={hardDeadlinePassed}
      myUserId={d.me?.id ?? null}
    />
  );
}
