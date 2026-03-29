import { BiddingRoomClient } from "@/app/auctions/_components/BiddingRoomClient";
import { loadAuctionDashboardForViewer, toBidGateContext } from "@/lib/auction-dashboard";

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
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Bidding room</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          You can see everyone&apos;s budgets, high bids, and rosters in this auction — same as every other
          manager.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <BiddingRoomClient auctionId={auctionId} lots={d.lots} gate={gate} />
      </div>
    </section>
  );
}
