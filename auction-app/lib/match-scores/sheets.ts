import type { MatchScoreGroup, MatchScoreSheet } from "./types";

/**
 * Active match score sheets for the current competition.
 * World Cup 2026 sheets were archived — see archive/world-cup-2026/ops/lib/match-scores-sheets.ts
 *
 * Add one MatchScoreSheet per completed PL match under Premier League GW1.
 */
export const MATCH_SCORE_SHEETS: MatchScoreSheet[] = [];

export const MATCH_SCORE_GROUPS: MatchScoreGroup[] = [
  {
    gw: 1,
    label: "Premier League GW1",
    sheets: MATCH_SCORE_SHEETS.filter((s) => s.groupStageGw === 1),
  },
];

export function getMatchScoreSheet(slug: string): MatchScoreSheet | undefined {
  return MATCH_SCORE_SHEETS.find((s) => s.slug === slug);
}
