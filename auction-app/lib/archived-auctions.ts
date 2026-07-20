/**
 * Auctions treated as archived in the participant UI (Active vs Archives).
 * World Cup 2026 parallel leagues — completed July 2026.
 *
 * Add future completed auction IDs here until a DB `archived_at` column exists.
 */
export const ARCHIVED_AUCTION_IDS: ReadonlySet<number> = new Set([5, 6, 7]);

export function isArchivedAuctionId(auctionId: number): boolean {
  return ARCHIVED_AUCTION_IDS.has(auctionId);
}
