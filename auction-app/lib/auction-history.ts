import { cache } from "react";

import { auctionHistoryYear, isArchivedAuctionId } from "@/lib/archived-auctions";
import { getLeaderboardData } from "@/lib/leaderboard-data";
import { createAdminClient } from "@/lib/supabase-server";

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

/**
 * Auction History for the signed-in auth user: archived tournaments they joined,
 * with final standings from `auction_leaderboard` (same source as the leaderboard page).
 * Sorted by year desc, then auction id desc (latest first).
 */
export const loadAuctionHistoryForUser = cache(
  async (authUserId: string): Promise<AuctionHistoryEntry[]> => {
    const admin = createAdminClient();
    const { data: seats, error: seatErr } = await admin
      .from("auction_users")
      .select("id, auction_id")
      .eq("user_id", authUserId);
    if (seatErr) throw new Error(seatErr.message);

    const seatsInHistory = (seats ?? []).filter((s: { auction_id: number }) =>
      isArchivedAuctionId(Number(s.auction_id)),
    ) as Array<{ id: number; auction_id: number }>;

    if (seatsInHistory.length === 0) return [];

    const auctionIds = [...new Set(seatsInHistory.map((s) => Number(s.auction_id)))];

    const { data: auctions, error: aErr } = await admin
      .from("Auctions")
      .select("id, name")
      .in("id", auctionIds);
    if (aErr) throw new Error(aErr.message);

    const nameById = new Map<number, string>();
    for (const a of auctions ?? []) {
      nameById.set(Number(a.id), (a.name as string | null) ?? `Auction #${a.id}`);
    }

    const seatByAuction = new Map<number, number>();
    for (const s of seatsInHistory) {
      seatByAuction.set(Number(s.auction_id), Number(s.id));
    }

    const entries: AuctionHistoryEntry[] = [];

    await Promise.all(
      auctionIds.map(async (auctionId) => {
        const auctionUserId = seatByAuction.get(auctionId);
        if (auctionUserId == null) return;

        const { standings } = await getLeaderboardData(auctionId);
        const mine = standings.find((e) => e.userId === auctionUserId);
        if (!mine) return;

        const year = auctionHistoryYear(auctionId) ?? new Date().getFullYear();
        entries.push({
          auctionId,
          auctionName: nameById.get(auctionId) ?? `Auction #${auctionId}`,
          year,
          rank: mine.rank,
          totalPoints: mine.total,
        });
      }),
    );

    entries.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.auctionId - a.auctionId;
    });

    return entries;
  },
);
