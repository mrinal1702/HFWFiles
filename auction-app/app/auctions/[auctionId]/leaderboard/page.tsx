export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Leaderboard</h2>
      <p className="text-sm text-neutral-500">
        Placeholder — standings for this auction will appear here. Later you will be able to inspect by
        game week.
      </p>
      <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/20 px-4 py-8 text-center text-sm text-neutral-500">
        No leaderboard data wired yet (auction #{auctionId}).
      </div>
    </section>
  );
}
