import "server-only";

import type { GroupStageGw } from "@/lib/match-scores/types";
import { MATCH_SCORE_SHEETS } from "@/lib/match-scores/sheets";

function isGroupStageGw(gameWeekId: number): gameWeekId is GroupStageGw {
  return gameWeekId === 1 || gameWeekId === 2 || gameWeekId === 3 || gameWeekId === 4;
}

/** player_id → in-match scoring role from FinalPoints (defender/midfielder/forward/goalkeeper). */
export function loadMatchPositionsForGameweek(gameWeekId: number): Map<string, string> {
  if (!isGroupStageGw(gameWeekId)) return new Map();

  const map = new Map<string, string>();
  for (const sheet of MATCH_SCORE_SHEETS) {
    if (sheet.groupStageGw !== gameWeekId) continue;
    for (const row of sheet.rows) {
      map.set(String(row.playerId), row.position);
    }
  }
  return map;
}
