import {
  EPL_2026_27,
  EPL_MATCH_SCORE_GROUPS,
  EPL_MATCH_SCORE_SHEETS,
} from "./competitions/epl-2026-27";
import { UCL_2026_27, UCL_MATCH_SCORE_GROUPS } from "./competitions/uefa-cl-2026-27";
import { WC_2026, WC_MATCH_SCORE_GROUPS, WC_MATCH_SCORE_SHEETS } from "./competitions/world-cup-2026";
import type { MatchScoreGroup, MatchScoreSheet } from "./types";

/**
 * Match score sheet registry. Each competition's sheets live in their own file under
 * ./competitions/<slug>.ts — add new matches there, not here.
 */

/** Matches public.competitions rows used by online auctions. */
export const COMPETITION_ID_TO_SLUG: Record<number, string> = {
  1: WC_2026,
  2: EPL_2026_27,
  4: UCL_2026_27,
};

const MATCH_SCORE_GROUPS_BY_SLUG: Record<string, MatchScoreGroup[]> = {
  [WC_2026]: WC_MATCH_SCORE_GROUPS,
  [EPL_2026_27]: EPL_MATCH_SCORE_GROUPS,
  [UCL_2026_27]: UCL_MATCH_SCORE_GROUPS,
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

/** World Cup 2026 sheets — legacy callers with no competition (e.g. meme-builds) use these. */
export const WC_SHEETS: MatchScoreSheet[] = WC_MATCH_SCORE_SHEETS;

export function getMatchScoreSheet(slug: string): MatchScoreSheet | undefined {
  return MATCH_SCORE_SHEETS.find((s) => s.slug === slug);
}
