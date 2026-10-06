/**
 * Opens bidding for auction 13 — "UEFA CL 2026/27 Auction 4".
 *
 * Fresh join-by-code league: the ONLY change is is_active false -> true.
 * Deadlines are already set (hard = Tue 8 Sep 2026 16:15 Europe/Dublin,
 * initiation/raise = null), lots are all uninitiated, and managers keep
 * joining with code UCLAUC4 before AND after opening (expected).
 *
 * Does NOT touch: hard/initiation/raise deadlines, transfer_window_open,
 * lots, managers, or any other auction.
 *
 * Usage:
 *   node scripts/open-ucl-auction-13-bidding.mjs --dry-run
 *   node scripts/open-ucl-auction-13-bidding.mjs
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
const dryRun = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const s = createClient(url, key);

const cols =
  "id,name,is_active,competition_id,bidding_deadline_mode,hard_deadline_at,initiation_deadline_at,raise_deadline_at,transfer_window_open,transfers_require_admin_approval,max_participants,join_code";

const { data: before, error: bErr } = await s.from("Auctions").select(cols).eq("id", AUCTION_ID).maybeSingle();
if (bErr) throw new Error(bErr.message);
if (!before) throw new Error(`auction ${AUCTION_ID} not found`);

console.log("=== BEFORE ===");
console.log(JSON.stringify(before, null, 2));
console.log(`hard_deadline Europe/Dublin: ${new Date(before.hard_deadline_at).toLocaleString("en-IE", { timeZone: "Europe/Dublin", dateStyle: "full", timeStyle: "short" })}`);

if (before.competition_id !== 4) throw new Error(`ABORT: auction ${AUCTION_ID} competition_id is ${before.competition_id}, expected 4`);
if (!before.hard_deadline_at) throw new Error("ABORT: hard_deadline_at not set");

if (before.is_active) {
  console.log("\nAlready active — nothing to do.");
  process.exit(0);
}

if (dryRun) {
  console.log("\nDry run — would set is_active = true (no other changes).");
  process.exit(0);
}

const { data: after, error: uErr } = await s
  .from("Auctions")
  .update({ is_active: true })
  .eq("id", AUCTION_ID)
  .select(cols)
  .single();
if (uErr) throw new Error(`open bidding: ${uErr.message}`);

console.log("\n=== AFTER ===");
console.log(JSON.stringify(after, null, 2));
console.log("\nBidding OPEN. Managers can join/bid with code", after.join_code);
