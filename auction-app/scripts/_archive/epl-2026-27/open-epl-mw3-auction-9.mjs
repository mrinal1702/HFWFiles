/**
 * Open EPL Matchweek 3 bidding for auction 9.
 *
 * Does NOT:
 *   - touch gameweek_squads (GW1/GW2 snapshots stay frozen)
 *   - change Game_Weeks.Is_Active
 *   - reset sold lots
 *   - change budgets (no +100 boost after GW2)
 *
 * Does:
 *   - reset paid_release_used
 *   - reopen unsold lots to uninitiated
 *   - set hard deadline Fri 4 Sep 2026 18:30 Europe/Dublin (90 min before MW3 kickoff)
 *   - clear initiation/raise deadlines
 *   - open transfer window
 *
 * Usage:
 *   node scripts/open-epl-mw3-auction-9.mjs --dry-run
 *   node scripts/open-epl-mw3-auction-9.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

const AUCTION_ID = 9;
const REQUIRED_GW_LOCK = 2;
const HARD_DEADLINE_ISO = "2026-09-04T17:30:00.000Z"; // 18:30 Europe/Dublin (IST, UTC+1)

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

function parseArgs(argv) {
  return { dryRun: argv.includes("--dry-run") };
}

async function countBy(supabase, table, filters) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count, error } = await q;
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

async function snapshot(supabase) {
  const { data: auction, error: aErr } = await supabase
    .from("Auctions")
    .select(
      "id,name,is_active,bidding_deadline_mode,initiation_deadline_at,raise_deadline_at,hard_deadline_at,transfer_window_open",
    )
    .eq("id", AUCTION_ID)
    .maybeSingle();
  if (aErr) throw new Error(aErr.message);
  if (!auction) throw new Error("Auction 9 not found");

  const { data: users, error: uErr } = await supabase
    .from("auction_users")
    .select("id,name,budget_remaining,active_budget,paid_release_used")
    .eq("auction_id", AUCTION_ID)
    .order("id");
  if (uErr) throw new Error(uErr.message);

  const lotStatuses = ["uninitiated", "bidding", "sold", "unsold"];
  const lotCounts = {};
  let lotTotal = 0;
  for (const status of lotStatuses) {
    const n = await countBy(supabase, "auction_lots", { auction_id: AUCTION_ID, status });
    lotCounts[status] = n;
    lotTotal += n;
  }

  const { data: gwSquads, error: gErr } = await supabase
    .from("gameweek_squads")
    .select("game_week_id")
    .eq("auction_id", AUCTION_ID);
  if (gErr) throw new Error(gErr.message);

  const gwCounts = {};
  for (const row of gwSquads ?? []) {
    const id = String(row.game_week_id);
    gwCounts[id] = (gwCounts[id] ?? 0) + 1;
  }

  const { count: teamCount, error: tErr } = await supabase
    .from("auction_teams")
    .select("*", { count: "exact", head: true })
    .eq("auction_id", AUCTION_ID);
  if (tErr) throw new Error(tErr.message);

  return {
    auction,
    users: users ?? [],
    lotCounts,
    gwCounts,
    lotTotal,
    teamCount: teamCount ?? 0,
  };
}

function printSnapshot(label, s) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(s.auction, null, 2));
  console.log(`Managers: ${s.users.length}`);
  for (const u of s.users) {
    console.log(
      `  ${u.id} ${u.name ?? "—"} remaining=${u.budget_remaining} active=${u.active_budget} paid_release_used=${u.paid_release_used}`,
    );
  }
  console.log("Lot statuses:", s.lotCounts);
  console.log("gameweek_squads by GW:", s.gwCounts);
  console.log(`auction_teams rows: ${s.teamCount}`);
}

async function main() {
  loadEnvLocal();
  const { dryRun } = parseArgs(process.argv);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(url, key);
  const before = await snapshot(supabase);
  printSnapshot("BEFORE", before);

  const dublinHard = new Date(HARD_DEADLINE_ISO).toLocaleString("en-GB", {
    timeZone: "Europe/Dublin",
    dateStyle: "full",
    timeStyle: "short",
    hour12: true,
  });
  console.log(`\nTarget hard deadline UTC: ${HARD_DEADLINE_ISO}`);
  console.log(`Target hard deadline Europe/Dublin: ${dublinHard}`);
  console.log("Initiation / raise: null (hard deadline only)");
  console.log("Budget boost: none");
  console.log("Transfers: open");
  console.log("Will NOT write gameweek_squads or Game_Weeks");

  if (!(before.gwCounts[String(REQUIRED_GW_LOCK)] > 0)) {
    throw new Error(
      `No gameweek_squads for GW${REQUIRED_GW_LOCK} on auction 9 — aborting so we do not open GW3 without a GW2 lock`,
    );
  }

  if ((before.lotCounts.bidding ?? 0) > 0) {
    throw new Error(
      `${before.lotCounts.bidding} lots still bidding — run finalize_auction_hard_deadline(9) first`,
    );
  }

  if (dryRun) {
    console.log("\n🏁 Dry run — no writes.");
    return;
  }

  const { error: relErr } = await supabase
    .from("auction_users")
    .update({ paid_release_used: false })
    .eq("auction_id", AUCTION_ID);
  if (relErr) throw new Error(`paid_release reset: ${relErr.message}`);
  console.log("\n✅ Reset paid_release_used = false");

  const unsoldCount = before.lotCounts.unsold ?? 0;
  if (unsoldCount > 0) {
    const { error: lotErr } = await supabase
      .from("auction_lots")
      .update({
        status: "uninitiated",
        expires_at: null,
        current_high_bid_id: null,
        current_high_bidder_id: null,
      })
      .eq("auction_id", AUCTION_ID)
      .eq("status", "unsold");
    if (lotErr) throw new Error(`reopen unsold: ${lotErr.message}`);
  }
  console.log(`✅ Reopened ${unsoldCount} unsold lots to uninitiated`);

  const { error: dErr } = await supabase
    .from("Auctions")
    .update({
      initiation_deadline_at: null,
      raise_deadline_at: null,
      hard_deadline_at: HARD_DEADLINE_ISO,
      is_active: true,
      transfer_window_open: true,
    })
    .eq("id", AUCTION_ID);
  if (dErr) throw new Error(`auction update: ${dErr.message}`);
  console.log("✅ Deadlines + transfer window updated");

  const after = await snapshot(supabase);
  printSnapshot("AFTER", after);

  const beforeGw = JSON.stringify(before.gwCounts);
  const afterGw = JSON.stringify(after.gwCounts);
  if (beforeGw !== afterGw) {
    throw new Error(`gameweek_squads changed unexpectedly: ${beforeGw} -> ${afterGw}`);
  }

  for (const u of before.users) {
    const afterUser = after.users.find((x) => x.id === u.id);
    if (
      afterUser &&
      (afterUser.budget_remaining !== u.budget_remaining || afterUser.active_budget !== u.active_budget)
    ) {
      throw new Error(`Budget changed for ${u.name ?? u.id} — aborting verification`);
    }
  }
  console.log("\n✅ gameweek_squads unchanged:", after.gwCounts);
  console.log("✅ budgets unchanged");
  console.log("Done.");
}

main().catch((err) => {
  console.error("\n❌", err.message || err);
  process.exit(1);
});
