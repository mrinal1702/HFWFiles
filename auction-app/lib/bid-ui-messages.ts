import type { PlaceBidErrorCode } from "@/lib/bidding";

/** User-facing copy for place_bid JSON error codes (see auction-bidding.sql + auction-deadline-rules.sql). */
const MESSAGES: Record<PlaceBidErrorCode, string> = {
  amount_must_be_integer: "Please enter a whole number — no decimals.",
  below_minimum_opening_bid: "The first bid on a player must be at least 5.",
  auction_not_found: "We couldn't find this auction.",
  hard_deadline_not_set: "This auction isn't open for bidding yet.",
  auction_deadline_passed: "The auction deadline has passed — no more bids.",
  initiation_deadline_passed:
    "The window for starting bids on new players has closed. You can still raise on players that are already in play.",
  lot_not_found: "We couldn't find this player in the auction.",
  lot_not_biddable: "This player isn't taking bids right now.",
  bid_too_low:
    "That amount isn't high enough anymore — someone may have just outbid you. Tap Refresh, check the current high bid, and try again.",
  bid_increment_too_small:
    "Your raise isn't large enough. After the raise deadline, every bid must go up by at least 5 (for example: if the high bid is 17, you must bid 22 or more).",
  bidder_not_in_auction: "You need to be in this auction as a manager to bid.",
  roster_full:
    "Your roster is full (18 players, including anyone you're currently winning a bid on).",
  goalkeeper_cap: "You can only roster one goalkeeper.",
  outfield_cap: "You've hit the outfield player limit for your roster.",
  insufficient_active_budget:
    "That bid is more than your available budget right now (winning bids count against what you can spend until things settle).",
};

export function placeBidErrorMessage(code: string): string {
  if (code in MESSAGES) return MESSAGES[code as PlaceBidErrorCode];
  return "We couldn't place that bid. Tap Refresh and try again, or pick a different amount.";
}

/**
 * Minimum next bid amount given the current high bid.
 * Pass raiseModeActive=true after the raise deadline to enforce the always-+5 rule.
 */
export function nextMinimumBidAmount(currentHigh: number | null, raiseModeActive = false): number {
  if (currentHigh == null || currentHigh < 5) return 5;
  if (raiseModeActive || currentHigh >= 50) return Math.floor(currentHigh) + 5;
  return Math.floor(currentHigh) + 1;
}

export function isGoalkeeperPosition(position: string | null | undefined): boolean {
  const p = (position ?? "").trim().toLowerCase();
  return p === "gk" || p === "goalkeeper";
}

/** Default list order: goalkeeper → defender → midfielder → forward → unknown. Lower sorts first. */
export function positionSortRank(position: string | null | undefined): number {
  const p = (position ?? "").trim().toLowerCase();
  if (p === "gk" || p.includes("goalkeeper")) return 0;
  if (p.includes("defend")) return 1;
  if (p.includes("midfield")) return 2;
  if (p.includes("forward")) return 3;
  return 4;
}
