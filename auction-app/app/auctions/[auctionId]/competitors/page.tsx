import { InfoTip } from "@/app/_components/InfoTip";
import { CompetitorsAuctionList } from "@/app/auctions/_components/CompetitorsAuctionList";
import { loadCompetitorsSummary } from "@/lib/auction-state/auction-dashboard";
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
      <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 py-3 pl-5 pr-3 shadow-sm sm:gap-4 sm:py-4 sm:pl-6 sm:pr-5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200 sm:h-11 sm:w-11"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1m20 0v-1a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
            />
          </svg>
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl uppercase tracking-wide">Competitors – Bidding</h2>
          <InfoTip
            text="Click on a competitor to see their team and the bids they currently hold"
            label="About Competitors – Bidding"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white/70 p-3 shadow-sm sm:p-5">
        <CompetitorsAuctionList auctionId={auctionId} rows={rows} />
      </div>
    </section>
  );
}
