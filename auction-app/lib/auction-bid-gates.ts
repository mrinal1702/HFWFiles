import { isGoalkeeperPosition } from "@/lib/bid-ui-messages";
import type { BidGateContext, EnrichedLot } from "@/lib/auction-types";

export function getBidDisabledReason(lot: EnrichedLot, ctx: BidGateContext): string | null {
  if (ctx.biddingClosed) {
    return ctx.biddingClosedReason ?? "Bidding has ended.";
  }
  if (ctx.viewerMode || !ctx.me) {
    return "Join this auction (or pick your manager seat) to place bids.";
  }
  if (lot.status === "sold") return "This player has already been sold.";
  if (lot.status === "unsold") return "This player is no longer available to bid on.";
  if (lot.status !== "uninitiated" && lot.status !== "bidding") {
    return "This player isn’t taking bids right now.";
  }
  if (lot.status === "bidding" && lot.expires_at) {
    const t = Date.parse(lot.expires_at);
    if (!Number.isNaN(t) && Date.now() >= t) {
      return "The timer for this player has run out.";
    }
  }

  const selfLeading = lot.high_bidder_id === ctx.me.id && lot.status === "bidding";
  if (!selfLeading) {
    if (ctx.meRosterSlots >= 18) {
      return "Your roster is full (18 players, including anyone you’re currently winning a bid on).";
    }
    if (isGoalkeeperPosition(lot.position) && ctx.meGkCount >= 1) {
      return "You can only roster one goalkeeper.";
    }
  }

  return null;
}
