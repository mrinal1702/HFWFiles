import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(appRoot, "..");

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const out = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",");
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    out.push(row);
  }
  return out;
}

function toBatches(arr, size) {
  const batches = [];
  for (let i = 0; i < arr.length; i += size) batches.push(arr.slice(i, i + size));
  return batches;
}

async function resolveTableName(supabase, candidates) {
  for (const name of candidates) {
    const res = await supabase.from(name).select("*").limit(1);
    if (!res.error || !String(res.error.message || "").includes("schema cache")) {
      return name;
    }
  }
  return null;
}

async function resolveColumnName(supabase, tableName, candidates) {
  for (const col of candidates) {
    const res = await supabase.from(tableName).select(col).limit(1);
    if (!res.error) return col;
    if (!String(res.error.message || "").includes("does not exist")) continue;
  }
  return null;
}

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Need NEXT_PUBLIC_SUPABASE_URL and key.",
    );
  }

  const csvPathArg = process.argv[2];
  const csvPath = csvPathArg || path.join(projectRoot, "Scores", "GW1_scores.csv");
  const csvText = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const csvRows = parseCsv(csvText);
  if (!csvRows.length) throw new Error(`No rows found in CSV: ${csvPath}`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  const playersTable = await resolveTableName(supabase, ["players", "Players"]);
  const scoresTable = await resolveTableName(supabase, ["player_scores", "Player_Scores"]);
  const gameWeeksTable = await resolveTableName(supabase, ["game_weeks", "Game_Weeks"]);
  if (!playersTable) throw new Error("Could not find players table.");
  if (!scoresTable) throw new Error("Could not find player scores table.");
  if (!gameWeeksTable) throw new Error("Could not find game weeks table.");

  const gwActiveCol = await resolveColumnName(gameWeeksTable ? supabase : null, gameWeeksTable, [
    "is_active",
    "Is_Active",
  ]);
  if (!gwActiveCol) throw new Error(`Could not find active column in ${gameWeeksTable}.`);

  const gwRows = await supabase
    .from(gameWeeksTable)
    .select("*")
    .eq(gwActiveCol, true);
  if (gwRows.error) throw new Error(`Failed to read active game week: ${gwRows.error.message}`);
  if (!gwRows.data || gwRows.data.length !== 1) {
    throw new Error(
      `Expected exactly 1 active game week in ${gameWeeksTable}; found ${gwRows.data?.length || 0}.`,
    );
  }
  const activeGwId = Number(gwRows.data[0].id);
  if (!Number.isFinite(activeGwId)) {
    throw new Error(`Active game week row has invalid id: ${gwRows.data[0].id}`);
  }

  const scoresPlayerCol = await resolveColumnName(supabase, scoresTable, ["player_id", "Player_ID"]);
  const scoresGwCol = await resolveColumnName(supabase, scoresTable, ["game_week_id", "Game_Week_ID", "gw_id"]);
  const scoresScoreCol = await resolveColumnName(supabase, scoresTable, ["score", "Score", "points", "Points"]);
  if (!scoresPlayerCol || !scoresGwCol || !scoresScoreCol) {
    throw new Error(
      `Could not resolve score table columns. player=${scoresPlayerCol}, gw=${scoresGwCol}, score=${scoresScoreCol}`,
    );
  }

  const payload = csvRows.map((r) => ({
    [scoresPlayerCol]: String(r.player_id ?? ""),
    [scoresGwCol]: activeGwId,
    [scoresScoreCol]: Number(r.score),
  }));

  // Missing players report
  const playerIdColumn = (await resolveColumnName(supabase, playersTable, ["player_id", "id"])) || "player_id";
  const csvIds = [...new Set(payload.map((p) => String(p[scoresPlayerCol])))];
  const existing = new Set();
  for (const batch of toBatches(csvIds, 300)) {
    const res = await supabase.from(playersTable).select(playerIdColumn).in(playerIdColumn, batch);
    if (res.error) throw new Error(`players existence check failed: ${res.error.message}`);
    for (const row of res.data || []) existing.add(String(row[playerIdColumn]));
  }
  const missing = csvIds.filter((id) => !existing.has(id));

  // Rerun-safe: replace rows for active gameweek.
  const del = await supabase.from(scoresTable).delete().eq(scoresGwCol, activeGwId);
  if (del.error) throw new Error(`Delete existing GW rows failed: ${del.error.message}`);

  let inserted = 0;
  for (const batch of toBatches(payload, 500)) {
    const ins = await supabase.from(scoresTable).insert(batch);
    if (ins.error) throw new Error(`Insert failed: ${ins.error.message}`);
    inserted += batch.length;
  }

  console.log(`Active game week id: ${activeGwId}`);
  console.log(`Uploaded ${inserted} rows to ${scoresTable}.`);
  console.log(`Mapped columns: ${scoresPlayerCol}, ${scoresGwCol}, ${scoresScoreCol}`);
  console.log(`Missing players in ${playersTable}: ${missing.length}`);
  if (missing.length) {
    console.log("Missing player IDs (first 30):", missing.slice(0, 30).join(", "));
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
