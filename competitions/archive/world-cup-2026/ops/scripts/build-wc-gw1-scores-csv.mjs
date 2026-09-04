/**
 * Build Scores/WC2026_GW1_scores.csv from all WC GW1 *FinalPoints.csv files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isKeeperUnitRow, resolveScorePlayerId } from "./lib/keeper-player-id.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (!q && c === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

const finalPointsFiles = [
  "Matches_Raw/World Cup 2026/Mexico_SouthAfrica_FinalPoints.csv",
  "Matches_Raw/World Cup 2026/SouthKorea_Czechia_FinalPoints.csv",
  "Matches_Raw/World Cup 2026/Canada_BosniaandHerzegovina_FinalPoints.csv",
  "Matches_Raw/World Cup 2026/USA_Paraguay_FinalPoints.csv",
];

const master = new Map();
const masterPath = path.join(repoRoot, "Player_List", "master_player_list.csv");
for (const line of fs.readFileSync(masterPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).slice(1)) {
  const cols = parseCsvLine(line);
  if (cols[0]) master.set(cols[0], cols[2]);
}

const rows = [];
for (const rel of finalPointsFiles) {
  const filePath = path.join(repoRoot, rel);
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  for (let i = 1; i < lines.length; i += 1) {
    const c = parseCsvLine(lines[i]);
    if (c.length < 7) continue;
    const rawId = Number(c[1]);
    const score = Number(c[6]);
    const player_name = c[0];
    const team_name = c[2];
    const position = c[3];
    const player_id = resolveScorePlayerId({ player_id: rawId, player_name, position });
    const team_id = isKeeperUnitRow({ player_name, position })
      ? rawId
      : Number(master.get(String(rawId)) || 0);
    rows.push({ player_id, player_name, team_id, team_name, score, gw_id: 1 });
  }
}

rows.sort((a, b) => a.team_name.localeCompare(b.team_name) || b.score - a.score);
const outPath = path.join(repoRoot, "Scores", "WC2026_GW1_scores.csv");
const header = "player_id,player_name,team_id,team_name,score,gw_id";
const body = rows.map((r) =>
  [r.player_id, r.player_name, r.team_id, r.team_name, r.score, r.gw_id].join(","),
);
fs.writeFileSync(outPath, [header, ...body].join("\n"), "utf8");
console.log(`Wrote ${rows.length} rows -> ${outPath}`);
