import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";
import {
  getLeaderboardData,
  getActiveGameWeek,
  getLockedGameWeeksForAuction,
  resolveGameweekPanel,
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

  const [d, { standings, gameWeeks }, activeGw, lockedGws] = await Promise.all([
    loadAuctionDashboardForViewer(auctionId),
    getLeaderboardData(auctionId),
    getActiveGameWeek(),
    getLockedGameWeeksForAuction(auctionId),
  ]);

  const hardDeadlineAt = d.auction?.hard_deadline_at;
  const hardDeadlinePassed = hardDeadlineAt
    ? Date.now() >= Date.parse(hardDeadlineAt)
    : false;

  const panelGwMap = new Map<number, { id: number; name: string }>();
  for (const gw of lockedGws) panelGwMap.set(gw.id, gw);
  if (activeGw && !panelGwMap.has(activeGw.id)) {
    panelGwMap.set(activeGw.id, activeGw);
  }

  const panelGws = [...panelGwMap.values()].sort((a, b) => a.id - b.id);

  const gameweekPanels = await Promise.all(
    panelGws.map((gw) =>
      resolveGameweekPanel(auctionId, gw, {
        hardDeadlinePassed,
        isActiveGw: activeGw?.id === gw.id,
      }),
    ),
  );

  return (
    <LeaderboardTabs
      standings={standings}
      gameWeeks={gameWeeks}
      activeGw={activeGw}
      gameweekPanels={gameweekPanels}
      myUserId={d.me?.id ?? null}
    />
  );
}
