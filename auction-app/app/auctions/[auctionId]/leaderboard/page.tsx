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
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Leaderboard</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          <span className="font-medium text-slate-800">Standings</span> shows total points across
          all gameweeks. <span className="font-medium text-slate-800">This Gameweek</span> shows
          the locked squad for the current round — yours and everyone else&apos;s.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <LeaderboardTabs
          standings={standings}
          gameWeeks={gameWeeks}
          activeGw={activeGw}
          squads={squads}
          myUserId={d.me?.id ?? null}
        />
      </div>
    </section>
  );
}
