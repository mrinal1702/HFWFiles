/**
 * Read-only access to an auction for people who hold no seat in it
 * (e.g. the commissioner watching a league they are not playing in).
 *
 * Spectators still cannot act: bidding, releases and transfers all resolve a
 * seat from `auction_users` and reject a user who has none.
 *
 * Key = auction id, value = auth user ids allowed to open it view-only.
 */
const AUCTION_SPECTATOR_USER_IDS: ReadonlyMap<number, ReadonlySet<string>> = new Map([
  // Auction 11 (UCL 2026/27)
  [
    11,
    new Set([
      "b23b15cc-e103-4248-ba55-d1bd6d0608c3", // Mrinal Trivedi, trivedi.mrinal.dinesh@gmail.com
      "4cca3de6-8b82-4c6d-94ad-df1396f3290a", // Nicolas Pastore, nicolas.pastore2006@gmail.com
    ]),
  ],
]);

export function isAuctionSpectator(
  auctionId: number,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return AUCTION_SPECTATOR_USER_IDS.get(auctionId)?.has(userId) ?? false;
}
