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
    return <span className="text-sm leading-snug text-amber-200/90">{disabledReason}</span>;
  }

  return (
    <div className="flex w-full min-w-0 max-w-md flex-col gap-2">
      <form
        action={formAction}
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-2"
      >
        <input type="hidden" name="auction_id" value={auctionId} />
        <input type="hidden" name="player_id" value={playerId} />
        <input
          name="amount"
          type="number"
          inputMode="numeric"
          step={1}
          min={minBid}
          placeholder={`≥ ${minBid}`}
          className="min-h-11 w-full min-w-0 flex-1 rounded border border-neutral-600 bg-neutral-900 px-3 py-2 text-base text-neutral-100 sm:max-w-[9rem] sm:text-sm"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 shrink-0 rounded-md bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50 sm:min-h-10 sm:min-w-[5rem]"
        >
          {pending ? "…" : "Bid"}
        </button>
      </form>
      {state && (
        <span
          className={`text-sm leading-snug ${state.ok ? "text-emerald-400/90" : "text-red-400/90"}`}
          role="status"
        >
          {state.message}
        </span>
      )}
    </div>
  );
}
