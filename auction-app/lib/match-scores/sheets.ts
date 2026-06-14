import { loadMatchScoreCsv } from "./parse-final-points";
import type { MatchScoreSheet } from "./types";

export const MATCH_SCORE_SHEETS: MatchScoreSheet[] = [
  {
    slug: "mexico-south-africa",
    title: "Mexico vs South Africa",
    subtitle: "World Cup 2026 · Group stage",
    rows: loadMatchScoreCsv("Mexico_SouthAfrica_FinalPoints.csv"),
  },
  {
    slug: "south-korea-czechia",
    title: "South Korea vs Czechia",
    subtitle: "World Cup 2026 · Group stage",
    rows: loadMatchScoreCsv("SouthKorea_Czechia_FinalPoints.csv"),
  },
  {
    slug: "canada-bosnia-herzegovina",
    title: "Canada vs Bosnia and Herzegovina",
    subtitle: "World Cup 2026 · Group stage",
    rows: loadMatchScoreCsv("Canada_BosniaandHerzegovina_FinalPoints.csv"),
  },
  {
    slug: "usa-paraguay",
    title: "USA vs Paraguay",
    subtitle: "World Cup 2026 · Group stage",
    rows: loadMatchScoreCsv("USA_Paraguay_FinalPoints.csv"),
  },
  {
    slug: "qatar-switzerland",
    title: "Qatar vs Switzerland",
    subtitle: "World Cup 2026 · Group stage",
    rows: loadMatchScoreCsv("Qatar_Switzerland_FinalPoints.csv"),
  },
];

export function getMatchScoreSheet(slug: string): MatchScoreSheet | undefined {
  return MATCH_SCORE_SHEETS.find((s) => s.slug === slug);
}
