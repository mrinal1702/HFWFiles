import { loadMatchScoreCsv } from "./parse-final-points";
import type { MatchScoreGroup, MatchScoreSheet } from "./types";

/**
 * Active match score sheets for the current competition.
 * World Cup 2026 sheets were archived — see archive/world-cup-2026/ops/lib/match-scores-sheets.ts
 */
const EPL_2026_27 = "epl-2026-27";
const UCL_2026_27 = "uefa-cl-2026-27";

/** Matches public.competitions rows used by online auctions. */
export const COMPETITION_ID_TO_SLUG: Record<number, string> = {
  2: EPL_2026_27,
  4: UCL_2026_27,
};

const EPL_MATCH_SCORE_SHEETS: MatchScoreSheet[] = [
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
  {
    slug: "liverpool-newcastle-united",
    title: "Newcastle United vs Liverpool",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    competitionSlug: EPL_2026_27,
    fotmobMatchId: 5795371,
    rows: loadMatchScoreCsv("NewcastleUnited_Liverpool_FinalPoints.csv", EPL_2026_27),
  },
  {
    slug: "chelsea-fulham",
    title: "Fulham vs Chelsea",
    subtitle: "Premier League · Matchweek 1",
    groupStageGw: 1,
    competitionSlug: EPL_2026_27,
    fotmobMatchId: 5795372,
    rows: loadMatchScoreCsv("Fulham_Chelsea_FinalPoints.csv", EPL_2026_27),
  },
  {
    slug: "crystal-palace-manchester-city",
    title: "Crystal Palace vs Manchester City",
    subtitle: "Premier League · Matchweek 2",
    groupStageGw: 2,
    competitionSlug: EPL_2026_27,
    fotmobMatchId: 5795429,
    rows: loadMatchScoreCsv("CrystalPalace_ManchesterCity_FinalPoints.csv", EPL_2026_27),
  },
];

const EPL_MATCH_SCORE_GROUPS: MatchScoreGroup[] = [
  {
    gw: 1,
    label: "Premier League GW1",
    sheets: EPL_MATCH_SCORE_SHEETS.filter((s) => s.groupStageGw === 1),
  },
  {
    gw: 2,
    label: "Premier League GW2",
    sheets: EPL_MATCH_SCORE_SHEETS.filter((s) => s.groupStageGw === 2),
  },
];

const MATCH_SCORE_GROUPS_BY_SLUG: Record<string, MatchScoreGroup[]> = {
  [EPL_2026_27]: EPL_MATCH_SCORE_GROUPS,
  [UCL_2026_27]: [],
};

/** Legacy default — EPL matchweek 1 sheets (public /match-scores page). */
export const MATCH_SCORE_SHEETS: MatchScoreSheet[] = EPL_MATCH_SCORE_SHEETS;

export const MATCH_SCORE_GROUPS: MatchScoreGroup[] = EPL_MATCH_SCORE_GROUPS;

export function getMatchScoreGroupsForCompetitionSlug(slug: string | null | undefined): MatchScoreGroup[] {
  if (!slug) return [];
  return MATCH_SCORE_GROUPS_BY_SLUG[slug] ?? [];
}

export function getMatchScoreGroupsForCompetitionId(competitionId: number | null | undefined): MatchScoreGroup[] {
  if (competitionId == null || !Number.isFinite(competitionId)) {
    return EPL_MATCH_SCORE_GROUPS;
  }
  const slug = COMPETITION_ID_TO_SLUG[competitionId];
  if (!slug) return [];
  return getMatchScoreGroupsForCompetitionSlug(slug);
}

export function getMatchScoreSheet(slug: string): MatchScoreSheet | undefined {
  return MATCH_SCORE_SHEETS.find((s) => s.slug === slug);
}
