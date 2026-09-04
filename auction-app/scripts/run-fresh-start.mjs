/**
 * Fresh-start reset: clears ALL auction data (regular + live auctions) then
 * re-imports the master player list from Player_List/master_player_list.csv.
 *
 * Steps:
 *   1. Clear live_auction_sales, live_auction_players, live_auction_participants,
 *      live_auctions  (parent delete cascades children, but we go child-first to
 *      be explicit and avoid any FK hiccups).
 *   2. Clear auction_score_breakdown, auction_leaderboard.
 *   3. Null FK pointers on auction_lots, then delete auction_bids, auction_lots,
 *      auction_teams, auction_users, "Auctions".
 *   4. Wipe public.players and re-insert from master_player_list.csv.
 *
 * Usage:
 *   node scripts/run-fresh-start.mjs
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
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { q = !q; continue; }
    if (!q && c === ",") { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseMasterCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => { row[h] = (values[j] ?? "").trim(); });
    rows.push(row);
  }
  return rows;
}

function toDbRow(r) {
  const pid = Number(r.player_id);
  const tid = Number(r.team_id);
  if (!Number.isFinite(pid) || !Number.isFinite(tid)) return null;
  return {
    player_id: pid,
    player_name: r.player_name || null,
    team_id: tid,
    team_name: r.team_name || null,
    position: r.position || null,
    href: r.href || null,
    source_files: r.source_files || null,
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function del(supabase, table, col, label) {
  console.log(`  Deleting ${label}…`);
  const { error } = await supabase.from(table).delete().not(col, "is", null);
  if (error) {
    console.error(`  ERROR on ${label}:`, error.message);
    process.exit(1);
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // ── 1. Live auction tables ──────────────────────────────────────────────────
  console.log("\n── Live auctions ──");
  await del(supabase, "live_auction_sales",       "id",         "live_auction_sales");
  await del(supabase, "live_auction_players",     "id",         "live_auction_players");
  await del(supabase, "live_auction_participants","id",         "live_auction_participants");
  await del(supabase, "live_auctions",            "id",         "live_auctions");

  // ── 2. Score / leaderboard tables ──────────────────────────────────────────
  console.log("\n── Score / leaderboard tables ──");
  await del(supabase, "auction_score_breakdown", "id",          "auction_score_breakdown");
  await del(supabase, "auction_leaderboard",     "auction_id",  "auction_leaderboard");

  // ── 3. Core bidding auction tables ─────────────────────────────────────────
  console.log("\n── Core bidding auction tables ──");

  console.log("  Nulling auction_lots FK pointers…");
  const { error: nullErr } = await supabase
    .from("auction_lots")
    .update({ current_high_bid_id: null, current_high_bidder_id: null })
    .not("auction_id", "is", null);
  if (nullErr) { console.error(nullErr.message); process.exit(1); }

  await del(supabase, "auction_bids",  "id",         "auction_bids");
  await del(supabase, "auction_lots",  "auction_id", "auction_lots");
  await del(supabase, "auction_teams", "auction_id", "auction_teams");
  await del(supabase, "auction_users", "id",         "auction_users");
  await del(supabase, "Auctions",      "id",         "Auctions");

  // ── 4. Players table ────────────────────────────────────────────────────────
  console.log("\n── Players table ──");
  const csvPath = path.resolve(appRoot, "..", "Player_List", "master_player_list.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("master_player_list.csv not found at:", csvPath);
    process.exit(1);
  }

  const rawRows = parseMasterCsv(fs.readFileSync(csvPath, "utf8"));
  const dbRows = rawRows.map(toDbRow).filter(Boolean);
  if (!dbRows.length) {
    console.error("No valid rows in master_player_list.csv");
    process.exit(1);
  }

  console.log(`  Deleting existing players…`);
  const { error: delErr } = await supabase.from("players").delete().not("player_id", "is", null);
  if (delErr) { console.error(delErr.message); process.exit(1); }

  let inserted = 0;
  for (const batch of chunk(dbRows, 400)) {
    const { error: insErr } = await supabase.from("players").insert(batch);
    if (insErr) { console.error("Insert error:", insErr.message); process.exit(1); }
    inserted += batch.length;
    console.log(`  Inserted ${inserted} / ${dbRows.length} players`);
  }

  console.log(`\n✓ Done.`);
  console.log(`  All auctions cleared.`);
  console.log(`  ${dbRows.length} players loaded from ${csvPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
