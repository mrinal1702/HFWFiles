import "server-only";

import type { MatchScoreSheet } from "@/lib/scoring/match-scores/types";
import {
  getMatchScoreGroupsForCompetitionId,
  getSheetsManifestForCompetitionId,
} from "@/lib/scoring/match-scores/sheets";

/**
 * Callers that pass no competition (only the parked meme-builds page, a World Cup 2026 side game)
 * read World Cup 2026 sheets (competition_id 1).
 */
const NO_COMPETITION_FALLBACK_ID = 1;

/** FinalPoints keeper rows use the club's team_id; squads own the keeper unit as 90_000_000 + team_id. */
const KEEPER_UNIT_OFFSET = 90_000_000;

function addRow(map: Map<string, string>, playerId: string, position: string): void {
  map.set(String(playerId), position);
  if (position.trim().toLowerCase() === "goalkeeper") {
    const teamId = Number(playerId);
    if (Number.isFinite(teamId) && teamId < KEEPER_UNIT_OFFSET) {
      map.set(String(KEEPER_UNIT_OFFSET + teamId), position);
    }
  }
}

function sheetsToPositionMap(sheets: MatchScoreSheet[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const sheet of sheets) {
    for (const row of sheet.rows) addRow(map, row.playerId, row.position);
  }
  return map;
}

/**
 * player_id → in-match scoring role from FinalPoints (defender/midfielder/forward/goalkeeper)
 * for one auction gameweek.
 *
 * The legacy game_week_id maps to the competition's matchweek via its sheets.json
 * (`legacy_game_week_start`): matchweek = gameWeekId − start + 1 (UCL 300 → 1, EPL 100 → 1,
 * WC 1 → 1). A competition with no sheets.json, or a gameweek with no registered sheets,
 * gets no positions — never another competition's.
 */
export function loadMatchPositionsForGameweek(
  gameWeekId: number,
  competitionId?: number | null,
): Map<string, string> {
  const id = competitionId ?? NO_COMPETITION_FALLBACK_ID;
  const manifest = getSheetsManifestForCompetitionId(id);
  if (!manifest || !Number.isFinite(gameWeekId)) return new Map();

  const ordinal = gameWeekId - manifest.legacy_game_week_start + 1;
  if (ordinal < 1) return new Map();

  const group = getMatchScoreGroupsForCompetitionId(id).find((g) => g.gw === ordinal);
  return group ? sheetsToPositionMap(group.sheets) : new Map();
}
