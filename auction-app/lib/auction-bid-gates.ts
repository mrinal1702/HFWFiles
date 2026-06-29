import { isGoalkeeperPosition } from "@/lib/bid-ui-messages";
import type { BidGateContext, EnrichedLot } from "@/lib/auction-types";

export function lotRaiseModeActive(lot: EnrichedLot, ctx: BidGateContext): boolean {
  if (ctx.nationRollingMode) return lot.nation_raise_mode_active;
  return ctx.raiseModeActive;
}

export function getBidDisabledReason(lot: EnrichedLot, ctx: BidGateContext): string | null {
  if (ctx.biddingClosed) {
    return ctx.biddingClosedReason ?? "Bidding has ended.";
  }
  if (lot.nation_bidding_closed) {
    const nation = lot.nation_name ?? "This nation";
    return `Bidding for ${nation} players has ended — those players are locked in your squad.`;
  }
  if (ctx.viewerMode || !ctx.me) {
    return "Join this auction (or pick your manager seat) to place bids.";
  }
  if (lot.status === "sold") return "This player has already been sold.";
  if (lot.status === "unsold") return "This player is no longer available to bid on.";
  if (lot.status !== "uninitiated" && lot.status !== "bidding") {
    return "This player isn't taking bids right now.";
  }
  if (lot.status === "bidding" && lot.expires_at) {
    const t = Date.parse(lot.expires_at);
    if (!Number.isNaN(t) && Date.now() >= t) {
      return "The timer for this player has run out.";
    }
  }

  const selfLeading = lot.high_bidder_id === ctx.me.id && lot.status === "bidding";
  if (!selfLeading) {
    if (lot.status === "uninitiated" && ctx.initiationClosed && !ctx.nationRollingMode) {
      return "The window for starting bids on new players has closed — you can still raise on players that are already in play.";
    }
    if (ctx.meRosterSlots >= 18) {
      return "Your roster is full (18 players, including anyone you're currently winning a bid on).";
    }
    if (isGoalkeeperPosition(lot.position) && ctx.meGkCount >= 1) {
      return "You can only roster one goalkeeper.";
    }
  }

  return null;
}
