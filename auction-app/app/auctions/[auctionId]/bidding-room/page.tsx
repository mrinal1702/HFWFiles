import { InfoTip } from "@/app/_components/InfoTip";
import { BiddingRoomClient } from "@/app/auctions/_components/BiddingRoomClient";

const BIDDING_ROOM_HELP =
  'Bidding room is where you place bids. You can see your budgets on the top and everyone else\'s budgets and high bids on the "Competitors" tab. You can filter and sort players based on your squad needs. Make sure to acquire a healthy mix of defenders, midfielders and forwards';
import { loadAuctionDashboardForViewer, toBidGateContext } from "@/lib/auction-state/auction-dashboard";

export const dynamic = "force-dynamic";

export default async function BiddingRoomPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const d = await loadAuctionDashboardForViewer(auctionId);
  const gate = toBidGateContext(d);

  return (
    <section className="space-y-3 sm:space-y-5">
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
              d="m14 4 6 6m-8-4 6 6m-9.5-.5 6-6M9 11l-6 6 2 2 6-6M13 21h8"
            />
          </svg>
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-xl uppercase tracking-wide">Bidding room</h2>
          <InfoTip text={BIDDING_ROOM_HELP} label="About the bidding room" />
        </div>
      </div>
      <div className="rounded-2xl border border-sky-100 bg-white/70 p-3 shadow-sm sm:p-5">
        <BiddingRoomClient auctionId={auctionId} lots={d.lots} gate={gate} />
      </div>
    </section>
  );
}
