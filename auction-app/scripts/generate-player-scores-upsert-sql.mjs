/**
 * Print a single SQL statement to upsert scores from *FinalPoints.csv files.
 * Keeper units are remapped to 90_000_000 + team_id (same as upsert script).
 * Paste output into Supabase SQL Editor.
 *
 * Usage:
 *   node scripts/generate-player-scores-upsert-sql.mjs <game_week_id> <csv> [csv...]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isKeeperUnitRow, resolveScorePlayerId } from "./lib/keeper-player-id.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseCsvLine(line) {
  const fields = [];
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

function parseFinalPointsFile(filePath) {
  const csvText = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 7) continue;
    const rawPlayerId = Number(cols[1]);
    const score = Number(cols[6]);
    if (!Number.isFinite(rawPlayerId) || !Number.isFinite(score)) continue;
    const player_name = cols[0];
    const position = cols[3];
    rows.push({
      player_id: resolveScorePlayerId({ player_id: rawPlayerId, player_name, position }),
      raw_player_id: rawPlayerId,
      score,
      is_keeper_unit: isKeeperUnitRow({ player_name, position }),
    });
  }
  return rows;
}

const gameWeekId = Number(process.argv[2]);
const csvPaths = process.argv.slice(3).map((p) => path.resolve(process.cwd(), p));

if (!Number.isFinite(gameWeekId) || !csvPaths.length) {
  console.error("Usage: node scripts/generate-player-scores-upsert-sql.mjs <game_week_id> <csv> [csv...]");
  process.exit(1);
}

const byPlayer = new Map();
const legacyKeeperTeamIds = new Set();
for (const csvPath of csvPaths) {
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }
  for (const row of parseFinalPointsFile(csvPath)) {
    byPlayer.set(row.player_id, row);
    if (row.is_keeper_unit) legacyKeeperTeamIds.add(row.raw_player_id);
  }
}

const json = JSON.stringify(
  [...byPlayer.values()].map((r) => ({ player_id: r.player_id, score: r.score })),
);
console.log(`-- ${byPlayer.size} players, game_week_id = ${gameWeekId}`);
console.log(`select public.upsert_player_scores(${gameWeekId}, '${json}'::jsonb);`);
if (legacyKeeperTeamIds.size) {
  const ids = [...legacyKeeperTeamIds].join(", ");
  console.log(`\n-- Remove pre-remap keeper rows (raw team_id as player_id):`);
  console.log(
    `delete from public."Player_Scores" where game_week_id = ${gameWeekId} and player_id in (${ids});`,
  );
}
