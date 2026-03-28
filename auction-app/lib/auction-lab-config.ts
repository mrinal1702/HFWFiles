/**
 * Test auction id for /auction-lab. Override in .env.local: AUCTION_LAB_AUCTION_ID=2
 */
export function getLabAuctionId(): number {
  const v = process.env.AUCTION_LAB_AUCTION_ID;
  if (!v?.trim()) return 1;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}
