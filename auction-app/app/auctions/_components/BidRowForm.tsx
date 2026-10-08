"use client";

import { useActionState, useEffect } from "react";

import { submitAuctionBidAction, type AuctionBidState } from "@/app/auctions/actions";
import { restoreScrollAfterBid, saveScrollForCurrentLocation } from "@/app/auctions/_components/scroll-restore";
import { InfoTip } from "@/app/_components/InfoTip";
import { SQUAD_LIMIT_HELP, SQUAD_LIMIT_REASON } from "@/lib/auction-state/squad-limit";

const input =
  "min-h-10 w-full min-w-[5.5rem] flex-1 rounded-xl border border-sky-200 bg-white px-3 py-2 font-mono text-base tabular-nums sm:text-sm text-slate-900 shadow-sm transition placeholder:font-sans focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 sm:min-h-10 sm:px-3 sm:py-2 md:max-w-[9rem]";

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
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/80 py-1 pl-2.5 pr-1 text-xs font-medium leading-snug text-slate-600">
        {disabledReason}
        {disabledReason === SQUAD_LIMIT_REASON && <InfoTip text={SQUAD_LIMIT_HELP} label="About the squad limit" />}
      </span>
    );
  }

  return (
    <div className="flex w-full min-w-0 max-w-md flex-col gap-1.5 sm:gap-2">
      <form
        action={formAction}
        onSubmitCapture={() => saveScrollForCurrentLocation()}
        className="flex flex-col gap-1.5 sm:flex-row sm:items-stretch sm:gap-2"
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
          className="min-h-9 shrink-0 rounded-xl bg-gradient-to-r from-sky-500 to-sky-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm shadow-sky-200 transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 sm:min-h-10 sm:min-w-[5rem] sm:px-4 sm:py-2"
        >
          {pending ? "…" : "Bid"}
        </button>
      </form>
      {state && (
        <span
          className={`text-xs leading-snug sm:text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}
          role="status"
        >
          {state.message}
        </span>
      )}
    </div>
  );
}
