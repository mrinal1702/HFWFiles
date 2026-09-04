/**
 * Live auctions hidden from Active Auctions on /dashboard.
 * Past verbal auctions (World Cup 2026 drills) — completed before UCL 26/27.
 */
export const ARCHIVED_LIVE_AUCTION_IDS: ReadonlySet<string> = new Set([
  "faf8aa0e-4613-4247-b6ce-28351dd92420", // WC 2026 Dummy
  "2e2b8be2-9573-47e4-9b54-7ebb4f9ba202", // HFW WC 2026 Auction 1 Live
  "ce30da92-b92c-4540-bde4-805b15ef8377", // HFW WC 2026 Auction 2 Live
  "1a133711-4a54-46a6-b150-1ece141288ba", // UEFA Champions League 2026/27 Auction 2 Live (moved online → Auction 12)
]);

export function isArchivedLiveAuctionId(auctionId: string): boolean {
  return ARCHIVED_LIVE_AUCTION_IDS.has(auctionId);
}
