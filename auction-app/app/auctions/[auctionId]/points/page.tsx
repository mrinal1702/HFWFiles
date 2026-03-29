export const dynamic = "force-dynamic";

export default async function PointsPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">My points</h2>
      <p className="text-sm leading-relaxed text-slate-600">
        Total score for this auction will appear here. Later you will be able to break down points by game
        week.
      </p>
      <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50/50 px-4 py-8 text-center text-sm text-slate-700">
        No scoring data yet (auction #{auctionId}).
      </div>
    </section>
  );
}
