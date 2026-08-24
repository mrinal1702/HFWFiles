import { loadMatchScoreCsv } from "./parse-final-points";
import type { MatchScoreGroup, MatchScoreSheet } from "./types";

/**
 * Active match score sheets for the current competition.
 * World Cup 2026 sheets were archived — see archive/world-cup-2026/ops/lib/match-scores-sheets.ts
 */
const EPL_2026_27 = "epl-2026-27";

export const MATCH_SCORE_SHEETS: MatchScoreSheet[] = [
  {
    slug: "arsenal-coventry-city",
    title: "Arsenal vs Coventry City",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    competitionSlug: EPL_2026_27,
    fotmobMatchId: 5795363,
    rows: loadMatchScoreCsv("Arsenal_CoventryCity_FinalPoints.csv", EPL_2026_27),
  },
  {
    slug: "hull-city-manchester-united",
    title: "Hull City vs Manchester United",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    competitionSlug: EPL_2026_27,
    fotmobMatchId: 5795364,
    rows: loadMatchScoreCsv("HullCity_ManchesterUnited_FinalPoints.csv", EPL_2026_27),
  },
  {
    slug: "ipswich-town-sunderland",
    title: "Ipswich Town vs Sunderland",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    competitionSlug: EPL_2026_27,
    fotmobMatchId: 5795366,
    rows: loadMatchScoreCsv("IpswichTown_Sunderland_FinalPoints.csv", EPL_2026_27),
  },
  {
    slug: "everton-crystal-palace",
    title: "Everton vs Crystal Palace",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    competitionSlug: EPL_2026_27,
    fotmobMatchId: 5795365,
    rows: loadMatchScoreCsv("Everton_CrystalPalace_FinalPoints.csv", EPL_2026_27),
  },
  {
    slug: "leeds-nottingham-forest",
    title: "Leeds United vs Nottingham Forest",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    competitionSlug: EPL_2026_27,
    fotmobMatchId: 5795367,
    rows: loadMatchScoreCsv("NottinghamForest_LeedsUnited_FinalPoints.csv", EPL_2026_27),
  },
  {
    slug: "brentford-tottenham-hotspur",
    title: "Brentford vs Tottenham Hotspur",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    competitionSlug: EPL_2026_27,
    fotmobMatchId: 5795368,
    rows: loadMatchScoreCsv("Brentford_TottenhamHotspur_FinalPoints.csv", EPL_2026_27),
  },
  {
    slug: "brighton-aston-villa",
    title: "Brighton & Hove Albion vs Aston Villa",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    competitionSlug: EPL_2026_27,
    fotmobMatchId: 5795369,
    rows: loadMatchScoreCsv("BrightonHoveAlbion_AstonVilla_FinalPoints.csv", EPL_2026_27),
  },
  {
    slug: "manchester-city-afc-bournemouth",
    title: "Manchester City vs AFC Bournemouth",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    competitionSlug: EPL_2026_27,
    fotmobMatchId: 5795370,
    rows: loadMatchScoreCsv("ManchesterCity_AFCBournemouth_FinalPoints.csv", EPL_2026_27),
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
