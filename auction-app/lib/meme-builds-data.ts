import "server-only";

import { loadMatchPositionsForGameweek } from "@/lib/match-positions-for-gw";
import {
  MEME_BUILD_GAME_WEEK_IDS,
  type MemeBuildGwInfo,
  type MemeBuildMatchPosMap,
  type MemeBuildPoolPlayer,
  type MemeBuildScoreMap,
} from "@/lib/meme-builds/types";
import { createAdminClient } from "@/lib/supabase-server";

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
  const admin = createAdminClient();
  const result: MemeBuildScoreMap = {};

  for (const gwId of gameWeekIds) {
    result[String(gwId)] = {};
  }

  const uniqueIds = [
    ...new Set(playerIds.map((id) => Number(id)).filter((n) => Number.isFinite(n))),
  ];
  if (!uniqueIds.length || !gameWeekIds.length) return result;

  const batchSize = 300;
  for (const gwId of gameWeekIds) {
    const gwKey = String(gwId);
    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const batch = uniqueIds.slice(i, i + batchSize);
      const viewRes = await admin
        .from("player_scores")
        .select("player_id, score")
        .eq("game_week_id", gwId)
        .in("player_id", batch);

      if (!viewRes.error) {
        for (const row of viewRes.data ?? []) {
          result[gwKey][String(row.player_id)] = Number(row.score);
        }
        continue;
      }

      const tableRes = await admin
        .from("Player_Scores")
        .select("player_id, Score")
        .eq("game_week_id", gwId)
        .in("player_id", batch);
      if (tableRes.error) throw new Error(`Player_Scores: ${tableRes.error.message}`);
      for (const row of tableRes.data ?? []) {
        result[gwKey][String(row.player_id)] = Number(row.Score);
      }
    }
  }

  return result;
}
