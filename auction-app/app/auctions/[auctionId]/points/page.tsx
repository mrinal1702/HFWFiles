export const dynamic = "force-dynamic";

export default async function PointsPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">My points</h2>
      <p className="text-sm text-neutral-500">
        Placeholder — total score for this auction will appear here. Later you will be able to break
        down points by game week.
      </p>
      <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/20 px-4 py-8 text-center text-sm text-neutral-500">
        No scoring data wired yet (auction #{auctionId}).
      </div>
    </section>
  );
}
