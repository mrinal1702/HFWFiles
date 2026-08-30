import { CompetitorsAuctionList } from "@/app/auctions/_components/CompetitorsAuctionList";
import { loadCompetitorsSummary } from "@/lib/auction-dashboard";
import { getAuthUser } from "@/lib/auth/get-user";

export const dynamic = "force-dynamic";

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const user = await getAuthUser();
  const rows = await loadCompetitorsSummary(auctionId, user?.id ?? null);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Competitors</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Every manager in this auction — budgets, squads, and active bids. Tap a name to see their
          team and the bids they&apos;re winning.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <CompetitorsAuctionList auctionId={auctionId} rows={rows} />
      </div>
    </section>
  );
}
