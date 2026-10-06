/**
 * Clears auction_teams, auction_lots, auction_bids, then auction_users, then Auctions.
 * auction_users is required so DELETE on Auctions succeeds when FK exists.
 *
 * Usage: node scripts/run-season-core-clear.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

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
    if (process.env[key] === undefined) process.env[key] = value;
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

  console.log("1) Nulling auction_lots high-bid pointers…");
  const { error: e1 } = await supabase
    .from("auction_lots")
    .update({ current_high_bid_id: null, current_high_bidder_id: null })
    .not("auction_id", "is", null);
  if (e1) {
    console.error(e1);
    process.exit(1);
  }

  console.log("2) Deleting auction_bids…");
  const { error: e2 } = await supabase.from("auction_bids").delete().not("id", "is", null);
  if (e2) {
    console.error(e2);
    process.exit(1);
  }

  console.log("3) Deleting auction_lots…");
  const { error: e3 } = await supabase.from("auction_lots").delete().not("auction_id", "is", null);
  if (e3) {
    console.error(e3);
    process.exit(1);
  }

  console.log("4) Deleting auction_teams…");
  const { error: e4 } = await supabase.from("auction_teams").delete().not("auction_id", "is", null);
  if (e4) {
    console.error(e4);
    process.exit(1);
  }

  console.log("5) Deleting auction_users (so Auctions rows can be removed)…");
  const { error: e5 } = await supabase.from("auction_users").delete().not("id", "is", null);
  if (e5) {
    console.error(e5);
    process.exit(1);
  }

  console.log('6) Deleting "Auctions"…');
  const { error: e6 } = await supabase.from("Auctions").delete().not("id", "is", null);
  if (e6) {
    console.error(e6);
    console.error(
      "\nIf this failed on another FK (e.g. auction_leaderboard), clear those rows in SQL Editor or run scripts/sql/season-reset-clear-core-auction-tables.sql with extra deletes."
    );
    process.exit(1);
  }

  console.log("\nDone. Core auction tables are empty. Remove or update AUCTION_LAB_AUCTION_ID in .env.local before the next dev session.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
