/**
 * Extra Trophy Cabinet awards (not league 1st-place finishes).
 * Shown only in Trophy Cabinet — never merged into Past Finishes.
 *
 * Auth user ids from auction_users.user_id for the WC 2026 seats.
 */
export type TrophyCabinetEntry = {
  auctionId: number;
  auctionName: string;
  year: number;
  /** Optional cup / special-award label shown next to the auction name. */
  awardLabel?: string | null;
  /** Stable list key when multiple trophies share an auction id. */
  key: string;
};

type ManualTrophyAward = {
  authUserId: string;
  auctionId: number;
  auctionName: string;
  year: number;
  awardLabel: string;
};

const MANUAL_TROPHY_AWARDS: readonly ManualTrophyAward[] = [
  {
    authUserId: "bf40ab6a-d4b2-453d-8a9f-5fd2eb118bc6", // Vihaan Shah
    auctionId: 5,
    auctionName: "HFW WC 2026 Auction 1 Online",
    year: 2026,
    awardLabel: "HFW 5-a-side Cup",
  },
  {
    authUserId: "d7ca460e-6ba3-497d-ba4a-4d430bdf258b", // Armaan Vardhan
    auctionId: 6,
    auctionName: "HFW WC 2026 Auction 2 Online",
    year: 2026,
    awardLabel: "HFW 5-a-side Cup",
  },
  {
    authUserId: "a60ff91d-7675-478c-b5ff-95ad1696cc9c", // Zahaan Bafna
    auctionId: 7,
    auctionName: "HFW WC Fantasy Auction 3 Online",
    year: 2026,
    awardLabel: "HFW 5-a-side Cup",
  },
];

type HistoryLike = {
  auctionId: number;
  auctionName: string;
  year: number;
  rank: number;
};

/** League champions (rank 1) + any manual cup awards for this auth user. */
export function buildTrophyCabinet(
  authUserId: string,
  history: HistoryLike[],
): TrophyCabinetEntry[] {
  const champions: TrophyCabinetEntry[] = history
    .filter((e) => e.rank === 1)
    .map((e) => ({
      auctionId: e.auctionId,
      auctionName: e.auctionName,
      year: e.year,
      awardLabel: null,
      key: `champion-${e.auctionId}`,
    }));

  const manuals: TrophyCabinetEntry[] = MANUAL_TROPHY_AWARDS.filter(
    (a) => a.authUserId === authUserId,
  ).map((a) => ({
    auctionId: a.auctionId,
    auctionName: a.auctionName,
    year: a.year,
    awardLabel: a.awardLabel,
    key: `manual-${a.auctionId}-${a.awardLabel}`,
  }));

  const merged = [...champions, ...manuals];
  merged.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.auctionId - a.auctionId;
  });
  return merged;
}
