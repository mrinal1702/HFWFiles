import type { MatchScoreGroup, MatchScoreSheet } from "./types";

/**
 * Active match score sheets for the current competition.
 * World Cup 2026 sheets were archived — see archive/world-cup-2026/auction-app/lib/match-scores-sheets.ts
 */
export const MATCH_SCORE_SHEETS: MatchScoreSheet[] = [];

export const MATCH_SCORE_GROUPS: MatchScoreGroup[] = [];

export function getMatchScoreSheet(slug: string): MatchScoreSheet | undefined {
  return MATCH_SCORE_SHEETS.find((s) => s.slug === slug);
}
