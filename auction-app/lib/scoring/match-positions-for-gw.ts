import "server-only";

import type { GroupStageGw, MatchScoreSheet } from "@/lib/scoring/match-scores/types";
import { getMatchScoreGroupsForCompetitionId, WC_SHEETS } from "@/lib/scoring/match-scores/sheets";

/** UEFA Champions League 2026/27 — competition_id 4, legacy GW ids 300–399. */
const UCL_2026_27_COMPETITION_ID = 4;
const UCL_2026_27_LEGACY_GW_START = 300;

/** English Premier League 2026/27 — competition_id 2, legacy GW ids 100–199 (MW1 = 100). */
const EPL_2026_27_COMPETITION_ID = 2;
const EPL_2026_27_LEGACY_GW_START = 100;

/** FIFA World Cup 2026 — competition_id 1, legacy GW ids 1–8 (= the WC gameweek). */
const WC_2026_COMPETITION_ID = 1;

function isWorldCupGameweek(gameWeekId: number): gameWeekId is GroupStageGw {
  return gameWeekId >= 1 && gameWeekId <= 8;
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
 * registered UCL sheets; EPL (id 2) maps ids 100–199. World Cup (id 1) and callers that
 * omit competitionId (meme-builds) use the World Cup sheets for GW 1–8. Any other
 * competition gets no positions rather than another competition's.
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

  if (competitionId != null && competitionId !== WC_2026_COMPETITION_ID) return new Map();
  if (!isWorldCupGameweek(gameWeekId)) return new Map();

  const map = new Map<string, string>();
  for (const sheet of WC_SHEETS) {
    if (sheet.groupStageGw !== gameWeekId) continue;
    for (const row of sheet.rows) {
      map.set(String(row.playerId), row.position);
    }
  }
  return map;
}
