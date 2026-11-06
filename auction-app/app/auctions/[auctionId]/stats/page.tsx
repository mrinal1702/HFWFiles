import { InfoTip } from "@/app/_components/InfoTip";
import { loadAuctionStats } from "@/lib/stats/auction-stats";

import { AuctionStatsClient } from "./_components/AuctionStatsClient";

export const dynamic = "force-dynamic";

const STATS_HELP =
  "Player stats for this competition, with value and free agents for this auction. Updated each time a gameweek's points are published.";

export default async function AuctionStatsPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const data = await loadAuctionStats(auctionId);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 py-3 pl-5 pr-3 shadow-sm sm:gap-4 sm:py-4 sm:pl-6 sm:pr-5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200 sm:h-11 sm:w-11"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m6 10V4m6 16v-7m4 7H2" />
          </svg>
        </span>
        <h2 className="text-lg font-semibold uppercase tracking-wide text-slate-900 sm:text-xl">Stats</h2>
        <InfoTip text={STATS_HELP} label="About stats" />
      </div>

      {data && data.gameweeks.length > 0 ? (
        <AuctionStatsClient auctionId={auctionId} data={data} />
      ) : (
        <div className="rounded-2xl border border-sky-100 bg-white p-4 text-sm text-slate-600 shadow-sm sm:p-5">
          Stats appear once the first gameweek&apos;s points are published.
        </div>
      )}
    </section>
  );
}
