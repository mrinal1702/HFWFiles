import "server-only";

import type { createAdminClient } from "@/lib/supabase-server";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * THE ONLY place in the app that reads player scores ("Player_Scores" / view `player_scores`).
 *
 * Scores are keyed by (player_id, game_week_id) and the same FotMob player exists in several
 * competitions, so a read must always be limited to gameweek ids that belong to the auction —
 * get them from `getLockedGameWeeksForAuction(auctionId)` (lib/scoring/leaderboard-data.ts).
 * Never look a player up across all gameweeks: that shows other competitions' points.
 *
 * `scripts/check-gameweek-surfaces.mjs` fails if any other file reads these tables.
 */

/** gameWeekId → (player_id → score) for the given gameweeks and players only. */
export async function readPlayerScores(
  admin: Admin,
  gameWeekIds: number[],
  playerIds: Array<string | number>,
): Promise<Map<number, Map<string, number>>> {
  const result = new Map<number, Map<string, number>>();
  const gwIds = [...new Set(gameWeekIds.filter((n) => Number.isFinite(n)))];
  const ids = [...new Set(playerIds.map((id) => Number(id)).filter((n) => Number.isFinite(n)))];
  for (const gw of gwIds) result.set(gw, new Map());
  if (!gwIds.length || !ids.length) return result;

  const batchSize = 300;
  for (const gw of gwIds) {
    const byPlayer = result.get(gw)!;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const viewRes = await admin
        .from("player_scores")
        .select("player_id, score")
        .eq("game_week_id", gw)
        .in("player_id", batch);
      if (!viewRes.error) {
        for (const row of viewRes.data ?? []) byPlayer.set(String(row.player_id), Number(row.score));
        continue;
      }
      const tableRes = await admin
        .from("Player_Scores")
        .select("player_id, Score")
        .eq("game_week_id", gw)
        .in("player_id", batch);
      if (tableRes.error) throw new Error(`Player_Scores: ${tableRes.error.message}`);
      for (const row of tableRes.data ?? []) byPlayer.set(String(row.player_id), Number(row.Score));
    }
  }
  return result;
}

/** The subset of the given (auction) gameweek ids that have at least one uploaded score. */
export async function gameWeeksWithScores(admin: Admin, gameWeekIds: number[]): Promise<Set<number>> {
  const scored = new Set<number>();
  for (const gw of gameWeekIds) {
    const viewRes = await admin.from("player_scores").select("player_id").eq("game_week_id", gw).limit(1);
    if (!viewRes.error && (viewRes.data?.length ?? 0) > 0) {
      scored.add(gw);
      continue;
    }
    const tableRes = await admin.from("Player_Scores").select("player_id").eq("game_week_id", gw).limit(1);
    if (!tableRes.error && (tableRes.data?.length ?? 0) > 0) scored.add(gw);
  }
  return scored;
}
