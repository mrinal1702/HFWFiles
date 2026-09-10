export type AuctionHistoryEntry = {
  auctionId: number;
  auctionName: string;
  year: number;
  /** Final season rank (1 = champion). */
  rank: number;
  totalPoints: number;
};

export function formatOrdinalRank(rank: number): string {
  const n = Math.abs(Math.trunc(rank));
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Trophy / medals for podium finishes only. */
export function finishMedalEmoji(rank: number): string | null {
  if (rank === 1) return "🏆";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

export function formatFinishLabel(rank: number): string {
  const medal = finishMedalEmoji(rank);
  return medal ? `${formatOrdinalRank(rank)} ${medal}` : formatOrdinalRank(rank);
}

/** First-place finishes only — Trophy Cabinet entries. */
export function trophiesFromHistory(entries: AuctionHistoryEntry[]): AuctionHistoryEntry[] {
  return entries.filter((e) => e.rank === 1);
}
