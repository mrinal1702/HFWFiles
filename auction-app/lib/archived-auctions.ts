/**
 * Auctions treated as archived in the participant UI (Active vs Archives).
 * World Cup 2026 parallel leagues — completed July 2026.
 *
 * Add future completed auction IDs here until a DB `archived_at` column exists.
 */
export const ARCHIVED_AUCTION_IDS: ReadonlySet<number> = new Set([5, 6, 7]);

/**
 * Competition year shown on Auction History rows.
 * Newer seasons: add `{ auctionId, year }` entries; history sorts newest first.
 */
export const AUCTION_HISTORY_YEARS: ReadonlyMap<number, number> = new Map([
  [5, 2026],
  [6, 2026],
  [7, 2026],
]);

export function isArchivedAuctionId(auctionId: number): boolean {
  return ARCHIVED_AUCTION_IDS.has(auctionId);
}

export function auctionHistoryYear(auctionId: number): number | null {
  return AUCTION_HISTORY_YEARS.get(auctionId) ?? null;
}
