import fs from "node:fs";
import path from "node:path";

import { loadMatchScoreCsv } from "./parse-final-points";
import type { MatchScoreGroup, MatchScoreSheet } from "./types";

/**
 * Match score sheet registry — DATA ONLY. Each competition has
 * `data/competitions/<slug>/sheets.json` (written by `scoring-engine/score_match.py`) plus its
 * FinalPoints CSVs in `data/competitions/<slug>/match-scores/`. A new match or a new gameweek is a
 * new entry in sheets.json — never a code change. A new gameweek becomes a new tab automatically.
 */
export type CompetitionSheetsManifest = {
  competition_slug: string;
  competition_id: number;
  display_name: string;
  /** Legacy game_week_id of matchweek 1 (UCL 2026/27 = 300, EPL 2026/27 = 100, WC 2026 = 1). */
  legacy_game_week_start: number;
  /** Tab label, e.g. "UEFA Champions League GW{n}". Overridden per gameweek by group_labels. */
  group_label_template: string;
  subtitle_template: string;
  group_labels: Record<string, string>;
  /** Shown on the public /match-scores page (and for auctions without a competition). */
  public_default?: boolean;
  sheets: Array<{
    slug: string;
    title: string;
    subtitle: string;
    gw: number;
    fotmob_match_id?: number;
    file: string;
  }>;
};

type LoadedCompetition = {
  manifest: CompetitionSheetsManifest;
  sheets: MatchScoreSheet[];
  groups: MatchScoreGroup[];
};

function loadCompetitions(): LoadedCompetition[] {
  const root = path.join(process.cwd(), "data", "competitions");
  if (!fs.existsSync(root)) return [];
  const out: LoadedCompetition[] = [];
  for (const dir of fs.readdirSync(root).sort()) {
    const manifestPath = path.join(root, dir, "sheets.json");
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as CompetitionSheetsManifest;
    const sheets: MatchScoreSheet[] = manifest.sheets.map((s) => ({
      slug: s.slug,
      title: s.title,
      subtitle: s.subtitle,
      groupStageGw: s.gw,
      competitionSlug: manifest.competition_slug,
      fotmobMatchId: s.fotmob_match_id,
      rows: loadMatchScoreCsv(s.file, manifest.competition_slug),
    }));
    const gws = [...new Set(sheets.map((s) => s.groupStageGw))].sort((a, b) => a - b);
    const groups: MatchScoreGroup[] = gws.map((gw) => ({
      gw,
      label: manifest.group_labels[String(gw)] ?? manifest.group_label_template.replace("{n}", String(gw)),
      sheets: sheets.filter((s) => s.groupStageGw === gw),
    }));
    out.push({ manifest, sheets, groups });
  }
  return out;
}

const COMPETITIONS = loadCompetitions();
const BY_SLUG = new Map(COMPETITIONS.map((c) => [c.manifest.competition_slug, c]));
const BY_ID = new Map(COMPETITIONS.map((c) => [Number(c.manifest.competition_id), c]));
const PUBLIC_DEFAULT = COMPETITIONS.find((c) => c.manifest.public_default) ?? null;

/** Matches public.competitions rows used by online auctions. */
export const COMPETITION_ID_TO_SLUG: Record<number, string> = Object.fromEntries(
  COMPETITIONS.map((c) => [c.manifest.competition_id, c.manifest.competition_slug]),
);

/** Public /match-scores page (competition flagged `public_default` in its sheets.json). */
export const MATCH_SCORE_SHEETS: MatchScoreSheet[] = PUBLIC_DEFAULT?.sheets ?? [];

export const MATCH_SCORE_GROUPS: MatchScoreGroup[] = PUBLIC_DEFAULT?.groups ?? [];

export function getSheetsManifestForCompetitionId(
  competitionId: number | null | undefined,
): CompetitionSheetsManifest | null {
  if (competitionId == null || !Number.isFinite(competitionId)) return null;
  return BY_ID.get(Number(competitionId))?.manifest ?? null;
}

export function getMatchScoreGroupsForCompetitionSlug(slug: string | null | undefined): MatchScoreGroup[] {
  if (!slug) return [];
  return BY_SLUG.get(slug)?.groups ?? [];
}

export function getMatchScoreGroupsForCompetitionId(competitionId: number | null | undefined): MatchScoreGroup[] {
  if (competitionId == null || !Number.isFinite(competitionId)) {
    return MATCH_SCORE_GROUPS;
  }
  return BY_ID.get(Number(competitionId))?.groups ?? [];
}

export function getMatchScoreSheet(slug: string): MatchScoreSheet | undefined {
  return MATCH_SCORE_SHEETS.find((s) => s.slug === slug);
}
