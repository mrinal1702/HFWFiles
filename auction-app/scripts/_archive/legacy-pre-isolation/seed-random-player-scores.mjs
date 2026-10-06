import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(appRoot, "..");

const TARGET_GW_ID = Number(process.argv[2] || 2);

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

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

async function getPlayerIds(supabase, playersTable) {
  const playerIdColumn = await resolveColumnName(supabase, playersTable, ["player_id", "id", "Player_ID"]);
  if (!playerIdColumn) throw new Error("Could not resolve player id column on players table.");

  const playersRows = await supabase.from(playersTable).select(playerIdColumn);
  if (playersRows.error) throw new Error(`players fetch failed: ${playersRows.error.message}`);

  const ids = [...new Set((playersRows.data || []).map((r) => String(r[playerIdColumn])).filter(Boolean))];
  return { ids, playerIdColumn };
}

async function getCsvPlayerIds() {
  const csvPath = path.join(workspaceRoot, "Player_List", "master_player_list.csv");
  if (!fs.existsSync(csvPath)) return [];
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""));
  return [...new Set(rows.map((r) => String(r.player_id || "").trim()).filter(Boolean))];
}

async function getAuctionTeamPlayerIds(supabase) {
  const rows = await supabase.from("auction_teams").select("player_id");
  if (rows.error) throw new Error(`auction_teams fetch failed: ${rows.error.message}`);
  return [...new Set((rows.data || []).map((r) => String(r.player_id || "")).filter(Boolean))];
}

async function filterExistingPlayerIds(supabase, playersTable, playerIdColumn, candidateIds) {
  const existing = new Set();
  for (const batch of toBatches(candidateIds, 300)) {
    const res = await supabase.from(playersTable).select(playerIdColumn).in(playerIdColumn, batch);
    if (res.error) throw new Error(`players existence check failed: ${res.error.message}`);
    for (const row of res.data || []) existing.add(String(row[playerIdColumn]));
  }
  return [...existing];
}

async function main() {
  loadEnvLocal();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Need NEXT_PUBLIC_SUPABASE_URL and key (prefer SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  if (!Number.isFinite(TARGET_GW_ID)) throw new Error(`Invalid game week id: ${TARGET_GW_ID}`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  const playersTable = await resolveTableName(supabase, ["players", "Players"]);
  const scoresTable = await resolveTableName(supabase, ["player_scores", "Player_Scores"]);
  if (!playersTable) throw new Error("Could not find players table.");
  if (!scoresTable) throw new Error("Could not find player scores table.");

  const scoresPlayerCol = await resolveColumnName(supabase, scoresTable, ["player_id", "Player_ID"]);
  const scoresGwCol = await resolveColumnName(supabase, scoresTable, ["game_week_id", "Game_Week_ID", "gw_id"]);
  const scoresScoreCol = await resolveColumnName(supabase, scoresTable, ["score", "Score", "points", "Points"]);
  if (!scoresPlayerCol || !scoresGwCol || !scoresScoreCol) {
    throw new Error(
      `Could not resolve player_scores columns. Found: player=${scoresPlayerCol}, gw=${scoresGwCol}, score=${scoresScoreCol}`,
    );
  }

  const { ids: tablePlayerIds, playerIdColumn } = await getPlayerIds(supabase, playersTable);
  let source = "players table";
  let playerIds = tablePlayerIds;

  if (!playerIds.length) {
    const csvIds = await getCsvPlayerIds();
    if (!csvIds.length) throw new Error("No player IDs found in players table or master_player_list.csv.");
    playerIds = await filterExistingPlayerIds(supabase, playersTable, playerIdColumn, csvIds);
    source = "master_player_list.csv filtered by existing players";
  }

  if (!playerIds.length) {
    playerIds = await getAuctionTeamPlayerIds(supabase);
    source = "auction_teams assigned players";
  }

  if (!playerIds.length) {
    throw new Error(
      "No existing players available to score after filtering. Check players table visibility/policies.",
    );
  }

  const seed = Number(process.argv[3] || Date.now());
  const rng = mulberry32(Number.isFinite(seed) ? seed : Date.now());

  // Random integer score range for simulation.
  const payload = playerIds.map((playerId) => ({
    [scoresPlayerCol]: playerId,
    [scoresGwCol]: TARGET_GW_ID,
    [scoresScoreCol]: Math.floor(rng() * 16),
  }));

  const del = await supabase.from(scoresTable).delete().eq(scoresGwCol, TARGET_GW_ID);
  if (del.error) throw new Error(`Failed deleting existing GW rows: ${del.error.message}`);

  let inserted = 0;
  for (const batch of toBatches(payload, 500)) {
    const ins = await supabase.from(scoresTable).insert(batch);
    if (ins.error) throw new Error(`Insert failed: ${ins.error.message}`);
    inserted += batch.length;
  }

  console.log(`Populated ${scoresTable} for game_week_id=${TARGET_GW_ID}`);
  console.log(`Rows inserted: ${inserted}`);
  console.log(`Player source: ${source}`);
  console.log(`Resolved columns: ${scoresPlayerCol}, ${scoresGwCol}, ${scoresScoreCol}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
