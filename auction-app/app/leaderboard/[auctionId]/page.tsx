import { getLeaderboardData } from "@/lib/leaderboard-data";
import { LeaderboardTabs } from "./_components/LeaderboardTabs";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const { standings, gameWeeks } = await getLeaderboardData(auctionId);

  return (
    <LeaderboardTabs auctionId={auctionId} standings={standings} gameWeeks={gameWeeks} />
  );
}
