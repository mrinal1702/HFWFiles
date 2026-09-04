/**
 * Incrementally add players to public.players and seed auction_lots (uninitiated)
 * for one or more auctions — without wiping the full player pool.
 *
 * Usage:
 *   node scripts/add-players-to-pool.mjs --auction-id 5 --auction-id 6 --auction-id 7 \
 *     --player "1515122,Arjan Malic,10106,Bosnia and Herzegovina,Defender,https://...,manual_wc2026_callup"
 *
 * Or read rows from master_player_list.csv by player_id:
 *   node scripts/add-players-to-pool.mjs --auction-id 5 --from-csv --player-id 1515122 --player-id 957203
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

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

function parseArgs(argv) {
  const auctionIds = [];
  const playerIds = [];
  let fromCsv = false;
  let csvPath = path.resolve(appRoot, "..", "Player_List", "master_player_list.csv");

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--from-csv") fromCsv = true;
    else if (a === "--csv" && argv[i + 1]) csvPath = path.resolve(argv[++i]);
    else if (a === "--auction-id" && argv[i + 1]) auctionIds.push(Number(argv[++i]));
    else if (a === "--player-id" && argv[i + 1]) playerIds.push(Number(argv[++i]));
    else {
      console.error(`Unknown arg: ${a}`);
      process.exit(1);
    }
  }
  return { auctionIds, playerIds, fromCsv, csvPath };
}

function rowsFromCsv(csvPath, playerIds) {
  const want = new Set(playerIds.map(String));
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const out = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const row = Object.fromEntries(headers.map((h, j) => [h, cols[j] ?? ""]));
    if (!want.has(String(row.player_id))) continue;
    const pid = Number(row.player_id);
    const tid = Number(row.team_id);
    if (!Number.isFinite(pid) || !Number.isFinite(tid)) continue;
    out.push({
      player_id: pid,
      player_name: row.player_name,
      team_id: tid,
      team_name: row.team_name,
      position: row.position,
      href: row.href,
      source_files: row.source_files || "manual_wc2026_callup",
    });
  }
  return out;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const { auctionIds, playerIds, fromCsv, csvPath } = parseArgs(process.argv);
  if (!auctionIds.length) {
    console.error("Provide at least one --auction-id");
    process.exit(1);
  }
  if (!playerIds.length) {
    console.error("Provide at least one --player-id (with --from-csv)");
    process.exit(1);
  }
  if (!fromCsv) {
    console.error("Currently only --from-csv mode is supported");
    process.exit(1);
  }

  const players = rowsFromCsv(csvPath, playerIds);
  if (players.length !== playerIds.length) {
    const found = new Set(players.map((p) => p.player_id));
    const missing = playerIds.filter((id) => !found.has(id));
    console.error("Could not find in CSV:", missing.join(", "));
    process.exit(1);
  }

  const supabase = createClient(url, key);

  for (const p of players) {
    const { error } = await supabase.from("players").upsert(p, { onConflict: "player_id" });
    if (error) {
      console.error(`players upsert failed for ${p.player_id}:`, error.message);
      process.exit(1);
    }
    console.log(`✓ players: ${p.player_name} (${p.player_id})`);
  }

  for (const auctionId of auctionIds) {
    const { data, error } = await supabase.rpc("seed_auction_lots_for_auction", {
      p_auction_id: auctionId,
    });
    if (error) {
      console.error(`seed_auction_lots_for_auction(${auctionId}):`, error.message);
      process.exit(1);
    }
    console.log(`✓ auction ${auctionId} lots:`, JSON.stringify(data));
  }

  console.log("\nDone. New lots start as uninitiated — commissioner can open them for bidding.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
