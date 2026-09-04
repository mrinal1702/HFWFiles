/**
 * Permanently delete trial auction 8 (Trial R16 Rolling Deadlines / TRIALR16)
 * and its trial Game_Week 99. Does NOT touch auctions 5/6/7.
 *
 * Usage: node scripts/delete-trial-auction-8.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const AUCTION_ID = 8;
const TRIAL_GW_ID = 99;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function del(supabase, table, label = table) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("auction_id", AUCTION_ID);
  if (error) {
    // Missing relation / column — skip soft
    if (
      /does not exist|Could not find the table|schema cache/i.test(error.message) ||
      error.code === "42P01" ||
      error.code === "PGRST205"
    ) {
      console.log(`  skip ${label}: ${error.message}`);
      return;
    }
    throw new Error(`${label}: ${error.message}`);
  }
  console.log(`  deleted ${label}: ${count ?? "?"} rows`);
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: before } = await supabase
    .from("Auctions")
    .select("id, name, join_code, is_active")
    .eq("id", AUCTION_ID)
    .maybeSingle();

  if (!before) {
    console.log(`Auction ${AUCTION_ID} not found — already gone.`);
  } else {
    console.log(`Deleting auction ${AUCTION_ID}: ${before.name} (${before.join_code})`);
  }

  console.log("1) Clear lot high-bid pointers…");
  {
    const { error } = await supabase
      .from("auction_lots")
      .update({ current_high_bid_id: null, current_high_bidder_id: null })
      .eq("auction_id", AUCTION_ID);
    if (error && !/does not exist|PGRST205/i.test(error.message)) {
      throw new Error(`null lot pointers: ${error.message}`);
    }
  }

  console.log("2) Child tables…");
  // Order: dependents before parents where possible
  for (const table of [
    "auction_transfers",
    "auction_elimination_refunds",
    "auction_participant_relegations",
    "auction_releases",
    "auction_score_breakdown",
    "auction_leaderboard",
    "gameweek_squads",
    "auction_bids",
    "auction_teams",
    "auction_lots",
    "auction_nation_deadlines",
    "auction_users",
  ]) {
    await del(supabase, table);
  }

  console.log("3) Auctions row…");
  {
    const { error, count } = await supabase
      .from("Auctions")
      .delete({ count: "exact" })
      .eq("id", AUCTION_ID);
    if (error) throw new Error(`Auctions: ${error.message}`);
    console.log(`  deleted Auctions: ${count ?? "?"} rows`);
  }

  console.log(`4) Trial Game_Week ${TRIAL_GW_ID}…`);
  {
    const { error, count } = await supabase
      .from("Game_Weeks")
      .delete({ count: "exact" })
      .eq("id", TRIAL_GW_ID);
    if (error) {
      console.log(`  skip Game_Weeks ${TRIAL_GW_ID}: ${error.message}`);
    } else {
      console.log(`  deleted Game_Weeks: ${count ?? "?"} rows`);
    }
  }

  const { data: after } = await supabase.from("Auctions").select("id, name").eq("id", AUCTION_ID);
  const { data: seats } = await supabase
    .from("auction_users")
    .select("id")
    .eq("auction_id", AUCTION_ID)
    .limit(1);

  console.log("\nVerify:");
  console.log(`  Auctions id=${AUCTION_ID}: ${(after ?? []).length === 0 ? "gone ✓" : "STILL PRESENT"}`);
  console.log(`  auction_users for ${AUCTION_ID}: ${(seats ?? []).length === 0 ? "gone ✓" : "STILL PRESENT"}`);

  const { data: remaining } = await supabase
    .from("Auctions")
    .select("id, name, is_active")
    .in("id", [5, 6, 7, 8])
    .order("id");
  console.log("  Auctions 5–8 now:", remaining);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
