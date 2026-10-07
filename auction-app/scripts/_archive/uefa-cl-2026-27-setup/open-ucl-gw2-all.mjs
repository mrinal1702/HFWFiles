/**
 * Open UEFA Champions League 2026/27 (competition_id = 4) GW2 bidding for
 * auctions 10, 11, 12, 13.
 *
 * Per auction, does:
 *   - reset paid_release_used = false (1 paid release per manager)
 *   - +100 budget boost to budget_remaining AND active_budget (one-time GW1->GW2)
 *   - reopen unsold lots -> uninitiated
 *   - set global deadlines (initiation / raise / hard), is_active = true,
 *     transfer_window_open = true
 *
 * Does NOT:
 *   - touch gameweek_squads (GW1 / id 300 snapshots stay frozen)
 *   - reset sold lots
 *   - touch any auction outside [10,11,12,13]
 *
 * Safety:
 *   - aborts an auction if competition_id !== 4
 *   - aborts if GW1 (game_week_id 300) is not locked
 *   - aborts if any lot is still in 'bidding' (finalize GW1 hard deadline first)
 *   - IDEMPOTENCY GUARD: if hard_deadline_at already equals the GW2 target,
 *     the auction is skipped (prevents a second +100 boost on accidental re-run)
 *
 * Usage:
 *   node scripts/open-ucl-gw2-all.mjs --dry-run
 *   node scripts/open-ucl-gw2-all.mjs
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

const AUCTION_IDS = [10, 11, 12, 13];
const EXPECTED_COMPETITION = 4;
const GW1_LEGACY_ID = 300;
const BUDGET_BOOST = 100;

// GW2 deadlines — 13 Oct 2026, IST (UTC+5:30). First game Lens v Sporting 22:15 IST.
const INITIATION_DEADLINE_ISO = "2026-10-13T13:15:00.000Z"; // 18:45 IST
const RAISE_DEADLINE_ISO = "2026-10-13T14:15:00.000Z"; // 19:45 IST
const HARD_DEADLINE_ISO = "2026-10-13T15:15:00.000Z"; // 20:45 IST

const dryRun = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const s = createClient(url, key);

const fmtIST = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "null";

async function countBy(table, filters) {
  let q = s.from(table).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count, error } = await q;
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

const AUCTION_COLS =
  "id,name,is_active,competition_id,bidding_deadline_mode,initiation_deadline_at,raise_deadline_at,hard_deadline_at,transfer_window_open";

async function snapshotAuction(id) {
  const { data: a, error: aErr } = await s.from("Auctions").select(AUCTION_COLS).eq("id", id).maybeSingle();
  if (aErr) throw new Error(aErr.message);
  const { data: users, error: uErr } = await s
    .from("auction_users")
    .select("id,name,budget_remaining,active_budget,paid_release_used")
    .eq("auction_id", id)
    .order("id");
  if (uErr) throw new Error(uErr.message);
  const lotCounts = {};
  for (const st of ["uninitiated", "bidding", "sold", "unsold"]) {
    lotCounts[st] = await countBy("auction_lots", { auction_id: id, status: st });
  }
  const { data: gw, error: gErr } = await s.from("gameweek_squads").select("game_week_id").eq("auction_id", id);
  if (gErr) throw new Error(gErr.message);
  const gwCounts = {};
  for (const r of gw) gwCounts[String(r.game_week_id)] = (gwCounts[String(r.game_week_id)] ?? 0) + 1;
  return { a, users: users ?? [], lotCounts, gwCounts };
}

// Snapshot of every OTHER auction, to prove we don't touch them.
async function snapshotOtherAuctions() {
  const { data, error } = await s
    .from("Auctions")
    .select("id,is_active,hard_deadline_at,initiation_deadline_at,raise_deadline_at,transfer_window_open")
    .not("id", "in", `(${AUCTION_IDS.join(",")})`)
    .order("id");
  if (error) throw new Error(error.message);
  return JSON.stringify(data ?? []);
}

async function main() {
  console.log(`\nGW2 open — auctions ${AUCTION_IDS.join(", ")}  (competition_id ${EXPECTED_COMPETITION})`);
  console.log(`  initiation: ${INITIATION_DEADLINE_ISO}  (${fmtIST(INITIATION_DEADLINE_ISO)} IST)`);
  console.log(`  raise:      ${RAISE_DEADLINE_ISO}  (${fmtIST(RAISE_DEADLINE_ISO)} IST)`);
  console.log(`  hard:       ${HARD_DEADLINE_ISO}  (${fmtIST(HARD_DEADLINE_ISO)} IST)`);
  console.log(`  budget boost: +${BUDGET_BOOST}   transfers: open   paid releases: reset\n`);

  const othersBefore = await snapshotOtherAuctions();

  for (const id of AUCTION_IDS) {
    console.log(`\n=================== AUCTION ${id} ===================`);
    const before = await snapshotAuction(id);
    if (!before.a) {
      throw new Error(`Auction ${id} not found`);
    }
    console.log(`BEFORE: is_active=${before.a.is_active} hard=${fmtIST(before.a.hard_deadline_at)} lots=${JSON.stringify(before.lotCounts)}`);
    console.log(`        managers=${before.users.length} GW1(300)_rows=${before.gwCounts[String(GW1_LEGACY_ID)] ?? 0}`);

    // --- Safety gates ---
    if (before.a.competition_id !== EXPECTED_COMPETITION) {
      throw new Error(`ABORT auction ${id}: competition_id=${before.a.competition_id}, expected ${EXPECTED_COMPETITION}`);
    }
    if (!before.gwCounts[String(GW1_LEGACY_ID)]) {
      throw new Error(`ABORT auction ${id}: GW1 (id ${GW1_LEGACY_ID}) not locked — will not open GW2`);
    }
    if ((before.lotCounts.bidding ?? 0) > 0) {
      throw new Error(`ABORT auction ${id}: ${before.lotCounts.bidding} lot(s) still 'bidding' — finalize GW1 hard deadline first`);
    }
    if (before.a.hard_deadline_at === HARD_DEADLINE_ISO) {
      console.log(`  ⏭️  SKIP: already on GW2 hard deadline — refusing to re-apply +${BUDGET_BOOST} boost.`);
      continue;
    }

    if (dryRun) {
      console.log(`  🏁 Dry run — would boost ${before.users.length} managers by +${BUDGET_BOOST}, reopen ${before.lotCounts.unsold} unsold, set deadlines, open transfers.`);
      continue;
    }

    // 1) reset paid releases
    {
      const { error } = await s.from("auction_users").update({ paid_release_used: false }).eq("auction_id", id);
      if (error) throw new Error(`paid_release reset (${id}): ${error.message}`);
    }
    // 2) +100 budget boost (both columns)
    for (const u of before.users) {
      const { error } = await s
        .from("auction_users")
        .update({ budget_remaining: u.budget_remaining + BUDGET_BOOST, active_budget: u.active_budget + BUDGET_BOOST })
        .eq("id", u.id)
        .eq("auction_id", id);
      if (error) throw new Error(`budget boost user ${u.id} (${id}): ${error.message}`);
    }
    // 3) reopen unsold -> uninitiated
    if ((before.lotCounts.unsold ?? 0) > 0) {
      const { error } = await s
        .from("auction_lots")
        .update({ status: "uninitiated", expires_at: null, current_high_bid_id: null, current_high_bidder_id: null })
        .eq("auction_id", id)
        .eq("status", "unsold");
      if (error) throw new Error(`reopen unsold (${id}): ${error.message}`);
    }
    // 4) deadlines + open bidding + open transfers
    {
      const { error } = await s
        .from("Auctions")
        .update({
          bidding_deadline_mode: "global",
          initiation_deadline_at: INITIATION_DEADLINE_ISO,
          raise_deadline_at: RAISE_DEADLINE_ISO,
          hard_deadline_at: HARD_DEADLINE_ISO,
          is_active: true,
          transfer_window_open: true,
        })
        .eq("id", id);
      if (error) throw new Error(`auction update (${id}): ${error.message}`);
    }

    const after = await snapshotAuction(id);
    // verify GW1 snapshot unchanged
    if (JSON.stringify(before.gwCounts) !== JSON.stringify(after.gwCounts)) {
      throw new Error(`ABORT auction ${id}: gameweek_squads changed unexpectedly`);
    }
    const boosted = after.users.every((u) => {
      const b = before.users.find((x) => x.id === u.id);
      return b && u.budget_remaining === b.budget_remaining + BUDGET_BOOST && u.active_budget === b.active_budget + BUDGET_BOOST;
    });
    console.log(
      `AFTER:  is_active=${after.a.is_active} hard=${fmtIST(after.a.hard_deadline_at)} transfers=${after.a.transfer_window_open} lots=${JSON.stringify(after.lotCounts)}`,
    );
    console.log(`        +${BUDGET_BOOST} applied to all managers: ${boosted ? "YES" : "NO ⚠️"}   paid_release reset: ${after.users.every((u) => !u.paid_release_used) ? "YES" : "NO ⚠️"}`);
  }

  const othersAfter = await snapshotOtherAuctions();
  if (othersBefore !== othersAfter) {
    throw new Error("ABORT: an auction outside [10,11,12,13] changed unexpectedly");
  }
  console.log("\n✅ Other auctions untouched.");
  console.log(dryRun ? "\n🏁 Dry run complete — no writes." : "\n✅ GW2 bidding OPEN for UCL auctions 10–13.");
}

main().catch((err) => {
  console.error("\n❌", err.message || err);
  process.exit(1);
});
