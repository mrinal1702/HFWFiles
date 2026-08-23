import { loadMatchScoreCsv } from "./parse-final-points";
import type { MatchScoreGroup, MatchScoreSheet } from "./types";

/**
 * Active match score sheets for the current competition.
 * World Cup 2026 sheets were archived — see archive/world-cup-2026/ops/lib/match-scores-sheets.ts
 */
export const MATCH_SCORE_SHEETS: MatchScoreSheet[] = [
  {
    slug: "arsenal-coventry-city",
    title: "Arsenal vs Coventry City",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    rows: loadMatchScoreCsv("Arsenal_CoventryCity_FinalPoints.csv"),
  },
  {
    slug: "hull-city-manchester-united",
    title: "Hull City vs Manchester United",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    rows: loadMatchScoreCsv("HullCity_ManchesterUnited_FinalPoints.csv"),
  },
];

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
