"use client";

import { useActionState } from "react";

import { submitAuctionBidAction, type AuctionBidState } from "@/app/auctions/actions";

export function BidRowForm({
  auctionId,
  playerId,
  minBid,
  disabledReason,
}: {
  auctionId: number;
  playerId: string;
  minBid: number;
  disabledReason: string | null;
}) {
  const [state, formAction, pending] = useActionState<AuctionBidState | null, FormData>(
    submitAuctionBidAction,
    null,
  );

  if (disabledReason) {
    return <span className="text-xs text-amber-200/90">{disabledReason}</span>;
  }

  return (
    <div className="flex min-w-[12rem] flex-col gap-1">
      <form action={formAction} className="flex flex-wrap items-center gap-1">
        <input type="hidden" name="auction_id" value={auctionId} />
        <input type="hidden" name="player_id" value={playerId} />
        <input
          name="amount"
          type="number"
          step={1}
          min={minBid}
          placeholder={`≥ ${minBid}`}
          className="w-24 rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-200 px-2 py-1 text-xs font-medium text-neutral-900 disabled:opacity-50"
        >
          {pending ? "…" : "Bid"}
        </button>
      </form>
      {state && (
        <span
          className={`text-xs ${state.ok ? "text-emerald-400/90" : "text-red-400/90"}`}
          role="status"
        >
          {state.message}
        </span>
      )}
    </div>
  );
}
