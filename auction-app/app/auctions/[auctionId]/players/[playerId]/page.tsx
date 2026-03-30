import Link from "next/link";
import { notFound } from "next/navigation";

import { loadAuctionDashboardForViewer, toBidGateContext } from "@/lib/auction-dashboard";
import { getBidDisabledReason } from "@/lib/auction-bid-gates";
import { nextMinimumBidAmount } from "@/lib/bid-ui-messages";

import { BidRowForm } from "@/app/auctions/_components/BidRowForm";

export const dynamic = "force-dynamic";

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ auctionId: string; playerId: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { auctionId: aRaw, playerId: pRaw } = await params;
  const auctionId = Number(aRaw);
  const playerId = String(pRaw);
  if (!Number.isFinite(auctionId) || auctionId <= 0) {
    notFound();
  }

  const d = await loadAuctionDashboardForViewer(auctionId);
  const gate = toBidGateContext(d);
  const lot = d.lots.find((l) => l.player_id === playerId);

  if (!lot) {
    notFound();
  }

  const displayStatus = (() => {
    if (gate.biddingClosed && lot.status === "bidding") return "Closed (auction ended)";
    switch (lot.status) {
      case "uninitiated":
        return "Unsold (no bids)";
      case "bidding":
        return "Ongoing bids";
      case "sold":
        return "Sold";
      case "unsold":
        return "Closed (unsold)";
      default:
        return lot.status;
    }
  })();

  const highBidDisplay =
    lot.status === "sold"
      ? lot.high_amount != null
        ? String(lot.high_amount)
        : "—"
      : lot.status === "uninitiated" || lot.status === "unsold"
        ? "—"
        : lot.high_amount != null
          ? String(lot.high_amount)
          : "—";

  const highBidderDisplay = lot.high_bidder_name ?? (lot.high_bidder_id != null ? `#${lot.high_bidder_id}` : "—");
  const timerDisplay =
    lot.status === "bidding" && !gate.biddingClosed ? (lot.expires_at ? new Date(lot.expires_at).toLocaleString() : "—") : "—";

  const minBid = nextMinimumBidAmount(lot.high_amount);
  const disabledReason = getBidDisabledReason(lot, gate);

  const returnToRaw = searchParams ? (await searchParams).returnTo : undefined;
  const backHref =
    typeof returnToRaw === "string" && returnToRaw.startsWith("/")
      ? returnToRaw
      : `/auctions/${auctionId}/bidding-room`;
  const backToSearchHref = `/auctions/${auctionId}/bidding-room?tab=search`;

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-600">Player</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
              {lot.player_name ?? `Player #${lot.player_id}`}
            </h2>
          </div>
          <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-slate-800">
            {displayStatus}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <div className="text-xs font-medium text-slate-600">High bid</div>
            <div className="mt-1 font-mono text-base font-semibold text-slate-900">{highBidDisplay}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <div className="text-xs font-medium text-slate-600">High bidder</div>
            <div className="mt-1 truncate text-sm font-medium text-slate-800">{highBidderDisplay}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm sm:col-span-2">
            <div className="text-xs font-medium text-slate-600">Timer</div>
            <div className="mt-1 text-sm text-slate-800">{timerDisplay}</div>
            <p className="mt-1 text-xs text-slate-600">
              Bids end at the auction hard deadline.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href={backHref}
              aria-label="Back to previous page"
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-800 shadow-sm hover:bg-sky-50/50"
            >
              ← Back
            </Link>
            <Link
              href={backToSearchHref}
              aria-label="Back to player search"
              className="min-h-11 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-sm font-medium text-sky-800 shadow-sm hover:bg-sky-100"
            >
              Back to search
            </Link>
          </div>
          <div className="text-xs text-slate-600">
            Tip: if the timer or high bid looks stale, tap <span className="font-medium text-slate-800">Refresh</span>.
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Place a bid</h3>
            {disabledReason ? (
              <div className="text-xs font-medium text-slate-600">Not available right now</div>
            ) : (
              <div className="text-xs font-medium text-slate-600">Next bid starts at {minBid}</div>
            )}
          </div>
          <div className="mt-3">
            <BidRowForm
              auctionId={auctionId}
              playerId={lot.player_id}
              minBid={minBid}
              disabledReason={disabledReason}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

