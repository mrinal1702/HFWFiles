/**
 * Auctions treated as archived in the participant UI (Active vs Archives).
 * World Cup 2026 parallel leagues — completed July 2026.
 *
 * Add future completed auction IDs here until a DB `archived_at` column exists.
 * History can include auctions that are not archived yet (see AUCTION_HISTORY_YEARS).
 */
export const ARCHIVED_AUCTION_IDS: ReadonlySet<number> = new Set([5, 6, 7]);

/**
 * Competition year shown on Auction History rows.
 * Presence in this map = eligible for Past Finishes / Trophy Cabinet champions,
 * even if the auction is still on Active Auctions (not in ARCHIVED_AUCTION_IDS).
 * Newer seasons: add `{ auctionId, year }` entries; history sorts newest first.
 */
export const AUCTION_HISTORY_YEARS: ReadonlyMap<number, number> = new Map([
  [5, 2026],
  [6, 2026],
  [7, 2026],
  // EPL 2026/27 online auction — finished (4 GWs) but kept on Active for now
  [9, 2026],
]);

export function isArchivedAuctionId(auctionId: number): boolean {
  return ARCHIVED_AUCTION_IDS.has(auctionId);
}

/** Auctions that appear in Auction History (Past Finishes / champion trophies). */
export function isHistoryAuctionId(auctionId: number): boolean {
  return AUCTION_HISTORY_YEARS.has(auctionId);
}

export function auctionHistoryYear(auctionId: number): number | null {
  return AUCTION_HISTORY_YEARS.get(auctionId) ?? null;
}
