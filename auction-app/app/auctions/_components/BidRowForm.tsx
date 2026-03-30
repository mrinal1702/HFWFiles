"use client";

import { useActionState, useEffect } from "react";

import { submitAuctionBidAction, type AuctionBidState } from "@/app/auctions/actions";
import { restoreScrollAfterBid, saveScrollForCurrentLocation } from "@/app/auctions/_components/scroll-restore";

const input =
  "min-h-11 w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 sm:max-w-[9rem] sm:text-sm";

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

  useEffect(() => {
    if (state?.ok !== true) return;
    restoreScrollAfterBid(playerId);
  }, [state, playerId]);

  if (disabledReason) {
    return <span className="text-sm leading-snug text-amber-800">{disabledReason}</span>;
  }

  return (
    <div className="flex w-full min-w-0 max-w-md flex-col gap-2">
      <form
        action={formAction}
        onSubmitCapture={() => saveScrollForCurrentLocation()}
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
          className={input}
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 sm:min-h-10 sm:min-w-[5rem]"
        >
          {pending ? "…" : "Bid"}
        </button>
      </form>
      {state && (
        <span
          className={`text-sm leading-snug ${state.ok ? "text-emerald-700" : "text-red-700"}`}
          role="status"
        >
          {state.message}
        </span>
      )}
    </div>
  );
}
