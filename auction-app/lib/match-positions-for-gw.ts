import "server-only";

import type { GroupStageGw, MatchScoreSheet } from "@/lib/match-scores/types";
import {
  getMatchScoreGroupsForCompetitionId,
  MATCH_SCORE_SHEETS,
} from "@/lib/match-scores/sheets";

/** UEFA Champions League 2026/27 — competition_id 4, legacy GW ids 300–399. */
const UCL_2026_27_COMPETITION_ID = 4;
const UCL_2026_27_LEGACY_GW_START = 300;

/** English Premier League 2026/27 — competition_id 2. MW1–3 reused ids 1–3; MW4+ use 100–199. */
const EPL_2026_27_COMPETITION_ID = 2;
const EPL_2026_27_LEGACY_GW_START = 100;

function isLegacyWorldCupGameweek(gameWeekId: number): gameWeekId is GroupStageGw {
  return gameWeekId >= 1 && gameWeekId <= 7;
}

function sheetsToPositionMap(sheets: MatchScoreSheet[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      map.set(String(row.playerId), row.position);
    }
  }
  return map;
}

/**
 * Map DB game_week_id → match-score group ordinal for UCL only.
 * mw01 → 300 → ordinal 1.
 */
function uclOrdinalFromLegacyGameWeekId(gameWeekId: number): number | null {
  if (!Number.isFinite(gameWeekId) || gameWeekId < UCL_2026_27_LEGACY_GW_START) return null;
  const ordinal = gameWeekId - UCL_2026_27_LEGACY_GW_START + 1;
  return ordinal >= 1 ? ordinal : null;
}

function loadUclMatchPositions(gameWeekId: number): Map<string, string> {
  const ordinal = uclOrdinalFromLegacyGameWeekId(gameWeekId);
  if (ordinal == null) return new Map();

  const groups = getMatchScoreGroupsForCompetitionId(UCL_2026_27_COMPETITION_ID);
  const group = groups.find((g) => g.gw === ordinal);
  if (!group) return new Map();
  return sheetsToPositionMap(group.sheets);
}

function eplOrdinalFromGameWeekId(gameWeekId: number): number | null {
  if (!Number.isFinite(gameWeekId)) return null;
  if (gameWeekId >= EPL_2026_27_LEGACY_GW_START && gameWeekId <= 199) {
    return gameWeekId - EPL_2026_27_LEGACY_GW_START + 1;
  }
  if (gameWeekId >= 1 && gameWeekId <= 7) return gameWeekId;
  return null;
}

function loadEplMatchPositions(gameWeekId: number): Map<string, string> {
  const ordinal = eplOrdinalFromGameWeekId(gameWeekId);
  if (ordinal == null) return new Map();

  const groups = getMatchScoreGroupsForCompetitionId(EPL_2026_27_COMPETITION_ID);
  const group = groups.find((g) => g.gw === ordinal);
  if (!group) return new Map();
  return sheetsToPositionMap(group.sheets);
}

/**
 * player_id → in-match scoring role from FinalPoints (defender/midfielder/forward/goalkeeper).
 *
 * Pass competitionId for competition-scoped auctions. UCL (id 4) maps legacy GW 300+ to
 * registered UCL sheets. EPL (id 2) maps MW1–3 (ids 1–3) and MW4+ (ids 100–199) to EPL sheets.
 * Other / omitted competitionId keeps the legacy WC-style 1–7 path
 * (meme-builds and older callers).
 */
export function loadMatchPositionsForGameweek(
  gameWeekId: number,
  competitionId?: number | null,
): Map<string, string> {
  if (competitionId === UCL_2026_27_COMPETITION_ID) {
    return loadUclMatchPositions(gameWeekId);
  }

  if (competitionId === EPL_2026_27_COMPETITION_ID) {
    return loadEplMatchPositions(gameWeekId);
  }

  if (!isLegacyWorldCupGameweek(gameWeekId)) return new Map();

  const map = new Map<string, string>();
  for (const sheet of MATCH_SCORE_SHEETS) {
    if (sheet.groupStageGw !== gameWeekId) continue;
    for (const row of sheet.rows) {
      map.set(String(row.playerId), row.position);
    }
  }
  return map;
}
