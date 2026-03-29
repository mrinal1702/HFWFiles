export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Leaderboard</h2>
      <p className="text-sm leading-relaxed text-slate-600">
        Standings for this auction will appear here. Later you will be able to inspect by game week.
      </p>
      <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50/50 px-4 py-8 text-center text-sm text-slate-700">
        No leaderboard data yet (auction #{auctionId}).
      </div>
    </section>
  );
}
