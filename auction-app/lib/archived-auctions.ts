import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase-server";

/**
 * Archive status is driven by the database: an online auction is archived when its
 * competition (`"Auctions".competition_id` → `competitions`) has `status = 'archived'`.
 * Archiving a competition (see scripts/sql/archive-competition.sql) archives every
 * auction attached to it. Auctions with no competition (e.g. lab auction 8) stay active.
 *
 * To run a new league against a competition that is already archived, create a new
 * `competitions` row for it rather than un-archiving the old one.
 */
export const loadArchivedCompetitionIds = cache(async (): Promise<ReadonlySet<number>> => {
  const admin = createAdminClient();
  const { data, error } = await admin.from("competitions").select("id").eq("status", "archived");
  if (error) throw new Error(`competitions(archived): ${error.message}`);
  return new Set((data ?? []).map((r: { id: number }) => Number(r.id)));
});

export function isArchivedCompetition(
  competitionId: number | null | undefined,
  archivedCompetitionIds: ReadonlySet<number>,
): boolean {
  return competitionId != null && archivedCompetitionIds.has(Number(competitionId));
}

/**
 * Competition year shown on Auction History rows.
 * Presence in this map = eligible for Past Finishes / Trophy Cabinet champions,
 * whether or not the auction is archived yet.
 * Newer seasons: add `{ auctionId, year }` entries; history sorts newest first.
 */
export const AUCTION_HISTORY_YEARS: ReadonlyMap<number, number> = new Map([
  [5, 2026],
  [6, 2026],
  [7, 2026],
  // EPL 2026/27 online auction (competition 2, archived Oct 2026)
  [9, 2026],
]);

/** Auctions that appear in Auction History (Past Finishes / champion trophies). */
export function isHistoryAuctionId(auctionId: number): boolean {
  return AUCTION_HISTORY_YEARS.has(auctionId);
}

export function auctionHistoryYear(auctionId: number): number | null {
  return AUCTION_HISTORY_YEARS.get(auctionId) ?? null;
}
