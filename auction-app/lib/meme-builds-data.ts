import "server-only";

import { loadMatchPositionsForGameweek } from "@/lib/scoring/match-positions-for-gw";
import {
  MEME_BUILD_GAME_WEEK_IDS,
  type MemeBuildGwInfo,
  type MemeBuildMatchPosMap,
  type MemeBuildPoolPlayer,
  type MemeBuildScoreMap,
} from "@/lib/meme-builds/types";
import { createAdminClient } from "@/lib/supabase-server";
import { readPlayerScores } from "@/lib/scoring/player-scores";

export type MemeBuildsPageData = {
  pool: MemeBuildPoolPlayer[];
  gameWeeks: MemeBuildGwInfo[];
  matchPositionsByGw: MemeBuildMatchPosMap;
};

export async function getMemeBuildsPageData(): Promise<MemeBuildsPageData> {
  const admin = createAdminClient();

  const [playersRes, gwRes] = await Promise.all([
    admin
      .from("players")
      .select("player_id, player_name, position, team_name")
      .order("player_name", { ascending: true }),
    admin
      .from("Game_Weeks")
      .select("id, GW_Name")
      .in("id", [...MEME_BUILD_GAME_WEEK_IDS])
      .order("id", { ascending: true }),
  ]);

  if (playersRes.error) throw new Error(`players: ${playersRes.error.message}`);
  if (gwRes.error) throw new Error(`Game_Weeks: ${gwRes.error.message}`);

  const pool: MemeBuildPoolPlayer[] = (playersRes.data ?? []).map((row) => ({
    playerId: String(row.player_id),
    playerName: row.player_name as string | null,
    position: row.position as string | null,
    country: row.team_name as string | null,
  }));

  const gwById = new Map(
    (gwRes.data ?? []).map((r) => [r.id as number, r.GW_Name as string]),
  );
  const gameWeeks: MemeBuildGwInfo[] = MEME_BUILD_GAME_WEEK_IDS.map((id) => ({
    id,
    name: gwById.get(id) ?? `GW ${id}`,
  }));

  const matchPositionsByGw: MemeBuildMatchPosMap = {};
  for (const gwId of MEME_BUILD_GAME_WEEK_IDS) {
    const map = loadMatchPositionsForGameweek(gwId);
    matchPositionsByGw[String(gwId)] = Object.fromEntries(map);
  }

  return { pool, gameWeeks, matchPositionsByGw };
}

export async function fetchMemeBuildScores(
  playerIds: string[],
  gameWeekIds: number[],
): Promise<MemeBuildScoreMap> {
  // Meme builds are a World Cup 2026 side game: gameWeekIds are WC gameweeks (1–8).
  const byGw = await readPlayerScores(createAdminClient(), gameWeekIds, playerIds);
  const result: MemeBuildScoreMap = {};
  for (const gwId of gameWeekIds) {
    result[String(gwId)] = Object.fromEntries(byGw.get(gwId) ?? new Map<string, number>());
  }
  return result;
}
