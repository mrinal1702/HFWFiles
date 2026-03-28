import { isGoalkeeperPosition } from "@/lib/bid-ui-messages";
import type { BidGateContext, EnrichedLot } from "@/lib/auction-types";

export function getBidDisabledReason(lot: EnrichedLot, ctx: BidGateContext): string | null {
  if (ctx.biddingClosed) {
    return ctx.biddingClosedReason ?? "Bidding is closed.";
  }
  if (ctx.viewerMode || !ctx.me) {
    return "You are not a bidder in this auction (view only).";
  }
  if (lot.status === "sold") return "Player already sold.";
  if (lot.status === "unsold") return "This lot is closed (unsold).";
  if (lot.status !== "uninitiated" && lot.status !== "bidding") {
    return "This lot is not open for bidding.";
  }
  if (lot.status === "bidding" && lot.expires_at) {
    const t = Date.parse(lot.expires_at);
    if (!Number.isNaN(t) && Date.now() >= t) {
      return "Lot timer has ended.";
    }
  }

  const selfLeading = lot.high_bidder_id === ctx.me.id && lot.status === "bidding";
  if (!selfLeading) {
    if (ctx.meRosterSlots >= 18) return "Roster is full (18 players).";
    if (isGoalkeeperPosition(lot.position) && ctx.meGkCount >= 1) {
      return "Goalkeeper limit reached.";
    }
  }

  return null;
}
