/**
 * Open a nation_rolling knockout round (per-nation raise/hard deadlines) across
 * multiple auctions. Mirrors scripts/sql/auction-qf-open-bidding-5-6-7.sql but
 * runs via the service-role client (no Supabase SQL Editor needed).
 *
 * Edit ROUND below per round, then:
 *   node scripts/open-nation-rolling-round.mjs --dry-run
 *   node scripts/open-nation-rolling-round.mjs
 *
 * Idempotent: Game_Weeks upsert, nation deadlines delete+insert, lots reopen by
 * status, paid-release reset. Writes a local JSON backup of the pre-change
 * Auctions rows + nation deadlines before applying.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

// ─── ROUND CONFIG (edit per round) ────────────────────────────────────────────
const ROUND = {
  gwId: 8,
  gwName: "FIFA World Cup Finals",
  auctionIds: [5, 6, 7],
  setActiveGameWeek: false, // GW8 scoring tab flips at squad lock, not at bidding open
  deactivateAllGameWeeks: false, // keep GW7 (SF) active on leaderboards during Final bidding
  hardBeforeKickoffMin: 90,
  raiseBeforeHardMin: 60,
  // Kickoffs in Dublin wall-clock (IST = UTC+1 in July → +01:00).
  // Final: Spain vs Argentina — Sun 19 Jul 2026 15:00 ET = 20:00 Dublin.
  fixtures: [
    { nations: ["Spain", "Argentina"], kickoff: "2026-07-19T20:00:00+01:00" },
  ],
};
// ──────────────────────────────────────────────────────────────────────────────

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

function buildNationRows() {
  const hardMs = ROUND.hardBeforeKickoffMin * 60_000;
  const raiseMs = ROUND.raiseBeforeHardMin * 60_000;
  const rows = [];
  for (const fx of ROUND.fixtures) {
    const kickoff = new Date(fx.kickoff);
    const hard = new Date(kickoff.getTime() - hardMs);
    const raise = new Date(hard.getTime() - raiseMs);
    for (const nation of fx.nations) {
      rows.push({
        team_name: nation,
        kickoff_at: kickoff.toISOString(),
        raise_deadline_at: raise.toISOString(),
        hard_deadline_at: hard.toISOString(),
      });
    }
  }
  return rows;
}

function fmtDublin(iso) {
  return new Date(iso).toLocaleString("en-IE", { timeZone: "Europe/Dublin" });
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key);

  const nationRows = buildNationRows();
  const globalHard = nationRows.reduce(
    (max, r) => (r.hard_deadline_at > max ? r.hard_deadline_at : max),
    nationRows[0].hard_deadline_at,
  );

  console.log(`Round: ${ROUND.gwName} (GW${ROUND.gwId})`);
  console.log(`Auctions: ${ROUND.auctionIds.join(", ")}`);
  console.log(`Global hard_deadline_at: ${globalHard}  (${fmtDublin(globalHard)} Dublin)`);
  console.log("\nPer-nation deadlines (Dublin):");
  for (const r of nationRows) {
    console.log(
      `  ${r.team_name.padEnd(12)} kickoff ${fmtDublin(r.kickoff_at)}  raise ${fmtDublin(
        r.raise_deadline_at,
      )}  hard ${fmtDublin(r.hard_deadline_at)}`,
    );
  }

  // Sanity: constraints raise < hard <= kickoff
  for (const r of nationRows) {
    if (!(r.raise_deadline_at < r.hard_deadline_at && r.hard_deadline_at <= r.kickoff_at)) {
      throw new Error(`Deadline constraint violated for ${r.team_name}`);
    }
  }

  // Preview lots to reopen
  const lotsRes = await supabase
    .from("auction_lots")
    .select("status")
    .in("auction_id", ROUND.auctionIds);
  if (lotsRes.error) throw new Error(`auction_lots read: ${lotsRes.error.message}`);
  const unsold = (lotsRes.data ?? []).filter((l) => l.status === "unsold").length;
  console.log(`\nLots to reopen (unsold → uninitiated): ${unsold}`);

  if (dryRun) {
    console.log("\n🏁  Dry run — no writes.");
    return;
  }

  // ── Backup current state to local JSON ──
  const backupDir = path.join(appRoot, "scripts", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const [aBak, ndBak] = await Promise.all([
    supabase.from("Auctions").select("*").in("id", ROUND.auctionIds),
    supabase.from("auction_nation_deadlines").select("*").in("auction_id", ROUND.auctionIds),
  ]);
  if (aBak.error) throw new Error(`backup Auctions: ${aBak.error.message}`);
  if (ndBak.error) throw new Error(`backup nation_deadlines: ${ndBak.error.message}`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `gw${ROUND.gwId}-pre-setup-${stamp}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ auctions: aBak.data, nation_deadlines: ndBak.data }, null, 2),
    "utf8",
  );
  console.log(`\n✅  Backed up pre-change state → ${backupPath}`);

  // 0) Game_Weeks row
  const gwCur = await supabase
    .from("Game_Weeks")
    .select("id, Is_Active")
    .eq("id", ROUND.gwId)
    .maybeSingle();
  if (gwCur.error) throw new Error(`Game_Weeks read: ${gwCur.error.message}`);
  const gwUp = await supabase
    .from("Game_Weeks")
    .upsert(
      { id: ROUND.gwId, GW_Name: ROUND.gwName, Is_Active: gwCur.data?.Is_Active ?? false },
      { onConflict: "id" },
    );
  if (gwUp.error) throw new Error(`Game_Weeks upsert: ${gwUp.error.message}`);
  console.log(`✅  Game_Weeks id=${ROUND.gwId} ready ("${ROUND.gwName}")`);

  // 1) Auctions → nation_rolling
  const aUp = await supabase
    .from("Auctions")
    .update({
      bidding_deadline_mode: "nation_rolling",
      rolling_game_week_id: ROUND.gwId,
      hard_deadline_at: globalHard,
      initiation_deadline_at: null,
      raise_deadline_at: null,
      is_active: true,
    })
    .in("id", ROUND.auctionIds);
  if (aUp.error) throw new Error(`Auctions update: ${aUp.error.message}`);
  console.log(`✅  Auctions ${ROUND.auctionIds.join(",")} → nation_rolling, rolling_game_week_id=${ROUND.gwId}`);

  // 2) Reset paid release quota
  const prUp = await supabase
    .from("auction_users")
    .update({ paid_release_used: false })
    .in("auction_id", ROUND.auctionIds);
  if (prUp.error) throw new Error(`paid_release reset: ${prUp.error.message}`);
  console.log("✅  paid_release_used reset to false");

  // 3) Reopen unsold lots → uninitiated
  const lotUp = await supabase
    .from("auction_lots")
    .update({
      status: "uninitiated",
      expires_at: null,
      current_high_bid_id: null,
      current_high_bidder_id: null,
    })
    .in("auction_id", ROUND.auctionIds)
    .eq("status", "unsold");
  if (lotUp.error) throw new Error(`lots reopen: ${lotUp.error.message}`);
  console.log(`✅  Reopened ${unsold} unsold lots → uninitiated`);

  // 4) Nation deadlines: delete then insert
  const del = await supabase
    .from("auction_nation_deadlines")
    .delete()
    .in("auction_id", ROUND.auctionIds);
  if (del.error) throw new Error(`nation_deadlines delete: ${del.error.message}`);

  const insertRows = [];
  for (const auctionId of ROUND.auctionIds) {
    for (const r of nationRows) {
      insertRows.push({ auction_id: auctionId, ...r });
    }
  }
  const ins = await supabase.from("auction_nation_deadlines").insert(insertRows);
  if (ins.error) throw new Error(`nation_deadlines insert: ${ins.error.message}`);
  console.log(`✅  Inserted ${insertRows.length} nation-deadline rows (${nationRows.length} nations × ${ROUND.auctionIds.length} auctions)`);

  // 5) Game_Weeks active flag (scoring tab)
  if (ROUND.setActiveGameWeek) {
    const off = await supabase.from("Game_Weeks").update({ Is_Active: false }).eq("Is_Active", true);
    if (off.error) throw new Error(`Game_Weeks deactivate: ${off.error.message}`);
    const on = await supabase.from("Game_Weeks").update({ Is_Active: true }).eq("id", ROUND.gwId);
    if (on.error) throw new Error(`Game_Weeks activate: ${on.error.message}`);
    console.log(`✅  GW${ROUND.gwId} set active on Game_Weeks`);
  } else if (ROUND.deactivateAllGameWeeks) {
    const off = await supabase.from("Game_Weeks").update({ Is_Active: false }).eq("Is_Active", true);
    if (off.error) throw new Error(`Game_Weeks deactivate: ${off.error.message}`);
    console.log("✅  Deactivated prior active gameweek(s) on Game_Weeks (GW7 stays inactive until lock)");
  }

  // ── Verify ──
  const [aVer, ndVer, lotVer, gwVer] = await Promise.all([
    supabase.from("Auctions").select("id, is_active, bidding_deadline_mode, rolling_game_week_id, hard_deadline_at").in("id", ROUND.auctionIds),
    supabase.from("auction_nation_deadlines").select("auction_id, team_name").in("auction_id", ROUND.auctionIds),
    supabase.from("auction_lots").select("status").in("auction_id", ROUND.auctionIds),
    supabase.from("Game_Weeks").select("id, GW_Name, Is_Active").order("id", { ascending: true }),
  ]);
  console.log("\n── Verify ──");
  for (const a of (aVer.data ?? []).sort((x, y) => x.id - y.id)) {
    console.log(`  Auction ${a.id}: mode=${a.bidding_deadline_mode} rollingGW=${a.rolling_game_week_id} active=${a.is_active} hard=${a.hard_deadline_at}`);
  }
  console.log(`  nation_deadline rows: ${(ndVer.data ?? []).length} (expect ${insertRows.length})`);
  const statusCounts = {};
  for (const l of lotVer.data ?? []) statusCounts[l.status] = (statusCounts[l.status] ?? 0) + 1;
  console.log(`  lot status: ${JSON.stringify(statusCounts)}`);
  console.log("  Game_Weeks:");
  for (const g of gwVer.data ?? []) console.log(`    ${g.id} ${g.Is_Active ? "[ACTIVE]" : "        "} ${g.GW_Name}`);

  console.log(`\nLive: https://hfwauction.vercel.app/leaderboard/${ROUND.auctionIds[0]}`);
}

main().catch((err) => {
  console.error("\n❌ ", err.message || err);
  process.exit(1);
});
