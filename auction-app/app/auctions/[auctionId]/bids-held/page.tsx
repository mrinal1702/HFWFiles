import { InfoTip } from "@/app/_components/InfoTip";
import { LeadingBidsList } from "@/app/auctions/_components/LeadingBidsList";
import { RosterSlotCounts } from "@/app/auctions/_components/RosterSlotCounts";
import { loadAuctionDashboardForViewer } from "@/lib/auction-state/auction-dashboard";

const BIDS_HELD_HELP =
  'These are the bids on players you are currently winning. The players you already purchased appear on the "My team" page';

export const dynamic = "force-dynamic";

export default async function BidsHeldPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const d = await loadAuctionDashboardForViewer(Number(raw));
  const returnTo = `/auctions/${Number(raw)}/bids-held`;
  const playerHref = (id: string) =>
    `/auctions/${Number(raw)}/players/${id}?returnTo=${encodeURIComponent(returnTo)}`;

  if (!d.me) {
    return (
      <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm leading-relaxed text-slate-600">
          Choose which manager you&apos;re acting as in the header to see the bids you&apos;re currently
          winning.
        </p>
      </section>
    );
  }

  const held = d.biddingClosed
    ? []
    : d.lots.filter((l) => l.status === "bidding" && l.high_bidder_id === d.me!.id);
  const owned = d.lots.filter((l) => l.status === "sold" && l.high_bidder_id === d.me!.id).length;

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 py-4 pl-5 pr-4 shadow-sm sm:py-5 sm:pl-6 sm:pr-5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200 sm:h-11 sm:w-11"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl uppercase tracking-wide">Bids held</h2>
              <InfoTip text={BIDS_HELD_HELP} label="About bids held" />
            </div>
          </div>
          <RosterSlotCounts owned={owned} bidsHeld={held.length} hideRemaining={d.biddingClosed} />
        </div>
      </div>

      {(d.biddingClosed || held.length > 0) && (
        <div className="rounded-2xl border border-sky-100 bg-white/70 p-3 shadow-sm sm:p-5">
          {d.biddingClosed ? (
            <p className="text-sm text-slate-600">Bidding is over — there are no active bids to show here.</p>
          ) : (
            <LeadingBidsList lots={held} playerHref={playerHref} bidLabel="Your bid" />
          )}
        </div>
      )}
    </section>
  );
}
