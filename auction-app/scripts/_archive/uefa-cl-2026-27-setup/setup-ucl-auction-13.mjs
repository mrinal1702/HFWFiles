/**
 * Creates online auction 13 — "UEFA CL 2026/27 Auction 4" (competition_id = 4).
 *
 * Fresh join-by-code league (same shape as auction 11):
 *   - INSERT the Auctions row (is_active = false until you open bidding)
 *   - seed the 981-player UCL lot pool via seed_auction_lots_for_auction(13)
 *
 * Managers join later with join_code UCLAUC4 (no admin code). Bidding is opened
 * separately. The 12h rolling window still needs a branch added to
 * nation-rolling-bidding-rpc.sql (place_bid) — done later per your note.
 *
 * Safety:
 *   - aborts if auction 13 already exists
 *   - aborts if lots already exist for auction 13
 *   - verifies the seeded pool matches competition_players (comp 4) and rolls
 *     back the lots if it does not
 *
 * Usage:
 *   node scripts/setup-ucl-auction-13.mjs --dry-run
 *   node scripts/setup-ucl-auction-13.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const rawLine of fs.readFileSync(path.join(appRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i > 0) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}

const AUCTION_ID = 13;
const COMPETITION = 4;
const NAME = "UEFA CL 2026/27 Auction 4";
const JOIN_CODE = "UCLAUC4";
const MAX_PARTICIPANTS = 15;
// 16:15 Europe/Dublin (IST, UTC+1) on Tue 8 Sep 2026 — same as auctions 10/11/12.
const HARD_DEADLINE_ISO = "2026-09-08T15:15:00.000Z";

const dryRun = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const s = createClient(url, key);

async function lotCount(auctionId) {
  const { count, error } = await s
    .from("auction_lots")
    .select("*", { count: "exact", head: true })
    .eq("auction_id", auctionId);
  if (error) throw new Error(`lot count: ${error.message}`);
  return count ?? 0;
}

async function pageAll(table, cols, eq) {
  let out = [];
  for (let from = 0; ; from += 1000) {
    let q = s.from(table).select(cols).range(from, from + 999);
    for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
    const r = await q;
    if (r.error) throw new Error(`${table}: ${r.error.message}`);
    out = out.concat(r.data);
    if (r.data.length < 1000) break;
  }
  return out;
}

// --- Preconditions -----------------------------------------------------------
const { data: existing, error: exErr } = await s
  .from("Auctions")
  .select("id,name")
  .eq("id", AUCTION_ID)
  .maybeSingle();
if (exErr) throw new Error(exErr.message);
if (existing) {
  console.error(`ABORT: auction ${AUCTION_ID} already exists (${JSON.stringify(existing.name)}).`);
  process.exit(1);
}

const { data: codeClash, error: ccErr } = await s
  .from("Auctions")
  .select("id,name")
  .eq("join_code", JOIN_CODE)
  .maybeSingle();
if (ccErr) throw new Error(ccErr.message);
if (codeClash) {
  console.error(`ABORT: join_code ${JOIN_CODE} already used by auction ${codeClash.id}.`);
  process.exit(1);
}

const poolSize = (await pageAll("competition_players", "player_id", { competition_id: COMPETITION })).length;

const row = {
  id: AUCTION_ID,
  name: NAME,
  is_active: false,
  join_code: JOIN_CODE,
  max_participants: MAX_PARTICIPANTS,
  competition_id: COMPETITION,
  hard_deadline_at: HARD_DEADLINE_ISO,
  initiation_deadline_at: null,
  raise_deadline_at: null,
  bidding_deadline_mode: "global",
  transfer_window_open: false,
  transfers_require_admin_approval: false,
};

console.log("=== PLAN ===");
console.log(JSON.stringify(row, null, 2));
console.log(`hard_deadline Europe/Dublin: ${new Date(HARD_DEADLINE_ISO).toLocaleString("en-IE", { timeZone: "Europe/Dublin", dateStyle: "full", timeStyle: "short" })}`);
console.log(`competition ${COMPETITION} pool size (lots to seed): ${poolSize}`);

if (dryRun) {
  console.log("\nDry run — no writes.");
  process.exit(0);
}

// --- Insert auction ----------------------------------------------------------
const { data: created, error: insErr } = await s.from("Auctions").insert(row).select().single();
if (insErr) throw new Error(`insert auction: ${insErr.message}`);
console.log(`\nCreated auction ${created.id}: ${created.name}`);

// --- Seed lots ---------------------------------------------------------------
const before = await lotCount(AUCTION_ID);
if (before !== 0) {
  console.error(`ABORT: auction ${AUCTION_ID} already has ${before} lots. Not seeding.`);
  process.exit(1);
}

const { data: rpc, error: rpcErr } = await s.rpc("seed_auction_lots_for_auction", { p_auction_id: AUCTION_ID });
if (rpcErr) throw new Error(`seed rpc: ${rpcErr.message}`);
console.log("seed rpc returned:", JSON.stringify(rpc));

const after = await lotCount(AUCTION_ID);
const pool = await pageAll("competition_players", "player_id", { competition_id: COMPETITION });
const poolIds = new Set(pool.map((p) => String(p.player_id).trim()));
const lots = await pageAll("auction_lots", "player_id,status", { auction_id: AUCTION_ID });
const statuses = [...new Set(lots.map((l) => l.status))];
const strays = lots.filter((l) => !poolIds.has(String(l.player_id).trim()));
const missing = [...poolIds].filter((id) => !lots.some((l) => String(l.player_id).trim() === id));

console.log(`lots after: ${after} | pool: ${poolIds.size} | statuses: ${JSON.stringify(statuses)} | strays: ${strays.length} | missing: ${missing.length}`);

const ok =
  after === poolIds.size &&
  strays.length === 0 &&
  missing.length === 0 &&
  statuses.length === 1 &&
  statuses[0] === "uninitiated";

if (!ok) {
  console.error("\nVERIFICATION FAILED — rolling back seeded lots for auction 13.");
  const { error: delErr } = await s.from("auction_lots").delete().eq("auction_id", AUCTION_ID);
  if (delErr) {
    console.error(`ROLLBACK FAILED: ${delErr.message} — delete manually.`);
    process.exit(2);
  }
  console.error(`rolled back. lots now: ${await lotCount(AUCTION_ID)}`);
  process.exit(1);
}

console.log(`\nOK — auction ${AUCTION_ID} created and ${after} lots seeded (all uninitiated, all from the UCL 2026/27 pool).`);
console.log("is_active = false (join open via UCLAUC4). Open bidding separately when ready.");
