import fs from "node:fs";
import path from "node:path";

import type { MatchScoreRow } from "./types";

/** Parse a single CSV line, respecting double-quoted fields. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

export function parseFinalPointsCsv(csvText: string): MatchScoreRow[] {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const rows: MatchScoreRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 7) continue;

    const hasShootout = cols.length >= 8;
    const finalScoreCol = hasShootout ? 7 : 6;

    rows.push({
      playerName: cols[0],
      playerId: cols[1],
      teamName: cols[2],
      position: cols[3],
      statsScore: Number(cols[4]),
      endowmentScore: Number(cols[5]),
      finalScore: Number(cols[finalScoreCol]),
    });
  }

  return rows.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return a.playerName.localeCompare(b.playerName, undefined, { sensitivity: "base" });
  });
}

/**
 * Load a FinalPoints CSV for a match.
 *
 * When `competitionSlug` is provided, reads the competition-scoped path
 * `data/competitions/<slug>/match-scores/<filename>`. Falls back to the legacy
 * flat `data/match-scores/<filename>` if the scoped file is not present, so the
 * app keeps working during the competition-isolation migration.
 */
export function loadMatchScoreCsv(filename: string, competitionSlug?: string): MatchScoreRow[] {
  const dataRoot = path.join(process.cwd(), "data");
  const candidates = competitionSlug
    ? [
        path.join(dataRoot, "competitions", competitionSlug, "match-scores", filename),
        path.join(dataRoot, "match-scores", filename),
      ]
    : [path.join(dataRoot, "match-scores", filename)];

  const filePath = candidates.find((p) => fs.existsSync(p)) ?? candidates[candidates.length - 1];
  const csvText = fs.readFileSync(filePath, "utf8");
  return parseFinalPointsCsv(csvText);
}
