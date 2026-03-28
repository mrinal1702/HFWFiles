import type { PlaceBidErrorCode } from "@/lib/bidding";

const MESSAGES: Record<PlaceBidErrorCode, string> = {
  amount_must_be_integer: "Use a whole number (no decimals).",
  below_minimum_opening_bid: "Minimum opening bid is 5.",
  auction_not_found: "Auction not found.",
  hard_deadline_not_set: "This auction has no deadline configured.",
  auction_deadline_passed: "Bidding is closed (auction deadline passed).",
  lot_not_found: "This player lot was not found.",
  lot_not_biddable: "This lot is not open for bidding.",
  bid_too_low: "Bid must be higher than the current bid.",
  bid_increment_too_small: "From 50 and up, bids must increase by at least 5.",
  bidder_not_in_auction: "You are not a bidder in this auction.",
  roster_full: "Roster is full (18 players including leading bids).",
  goalkeeper_cap: "You already have a goalkeeper (sold or leading bid).",
  outfield_cap: "Outfield player limit reached for your roster.",
  insufficient_active_budget: "Insufficient active budget for this bid.",
};

export function placeBidErrorMessage(code: string): string {
  if (code in MESSAGES) return MESSAGES[code as PlaceBidErrorCode];
  return `Bid rejected: ${code}`;
}

/** Minimum next bid amount (strictly greater than currentHigh), or opening minimum 5. */
export function nextMinimumBidAmount(currentHigh: number | null): number {
  if (currentHigh == null || currentHigh < 5) return 5;
  if (currentHigh < 50) return Math.floor(currentHigh) + 1;
  return Math.floor(currentHigh) + 5;
}

export function isGoalkeeperPosition(position: string | null | undefined): boolean {
  const p = (position ?? "").trim().toLowerCase();
  return p === "gk" || p === "goalkeeper";
}
