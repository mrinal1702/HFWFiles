/**
 * READ-ONLY precheck for opening UCL 2026/27 (competition_id = 4) GW2 bidding.
 * Inspects auctions 10, 11, 12, 13. Makes NO writes.
 *
 * Reports per auction: current auction row (is_active, deadlines, transfer
 * window, mode), manager count + budgets + paid_release_used, lot status
 * counts, and gameweek_squads counts by GW (to confirm GW1 / id 300 lock).
 *
 * Usage:
 *   node scripts/inspect-ucl-gw2-precheck.mjs
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

for (const id of AUCTION_IDS) {
  console.log(`\n======================= AUCTION ${id} =======================`);
  const { data: a, error: aErr } = await s
    .from("Auctions")
    .select(
      "id,name,is_active,competition_id,bidding_deadline_mode,initiation_deadline_at,raise_deadline_at,hard_deadline_at,transfer_window_open,transfers_require_admin_approval,max_participants,join_code,rolling_game_week_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (aErr) throw new Error(aErr.message);
  if (!a) {
    console.log(`  ⚠️  Auction ${id} NOT FOUND`);
    continue;
  }
  console.log(`  name: ${a.name}`);
  console.log(`  competition_id: ${a.competition_id}${a.competition_id === EXPECTED_COMPETITION ? "" : "  ⚠️ EXPECTED 4"}`);
  console.log(`  is_active: ${a.is_active}   mode: ${a.bidding_deadline_mode}   join_code: ${a.join_code ?? "—"}`);
  console.log(`  transfer_window_open: ${a.transfer_window_open}   require_admin_approval: ${a.transfers_require_admin_approval}`);
  console.log(`  max_participants: ${a.max_participants}   rolling_game_week_id: ${a.rolling_game_week_id ?? "—"}`);
  console.log(`  initiation: ${fmtIST(a.initiation_deadline_at)} IST`);
  console.log(`  raise:      ${fmtIST(a.raise_deadline_at)} IST`);
  console.log(`  hard:       ${fmtIST(a.hard_deadline_at)} IST`);

  const { data: users, error: uErr } = await s
    .from("auction_users")
    .select("id,name,budget_remaining,active_budget,paid_release_used")
    .eq("auction_id", id)
    .order("id");
  if (uErr) throw new Error(uErr.message);
  console.log(`  managers: ${users.length}`);
  for (const u of users) {
    console.log(
      `    ${u.id} ${u.name ?? "—"}  remaining=${u.budget_remaining} active=${u.active_budget} paid_release_used=${u.paid_release_used}`,
    );
  }

  const lotCounts = {};
  for (const st of ["uninitiated", "bidding", "sold", "unsold"]) {
    lotCounts[st] = await countBy("auction_lots", { auction_id: id, status: st });
  }
  console.log(`  lots:`, lotCounts);
  if (lotCounts.bidding > 0) {
    console.log(`    ⚠️  ${lotCounts.bidding} lot(s) still 'bidding' — GW1 hard deadline may not be finalized.`);
  }

  const { data: gw, error: gErr } = await s
    .from("gameweek_squads")
    .select("game_week_id")
    .eq("auction_id", id);
  if (gErr) throw new Error(gErr.message);
  const gwCounts = {};
  for (const r of gw) gwCounts[String(r.game_week_id)] = (gwCounts[String(r.game_week_id)] ?? 0) + 1;
  console.log(`  gameweek_squads by GW:`, Object.keys(gwCounts).length ? gwCounts : "(none)");
  console.log(
    `  GW1 (id ${GW1_LEGACY_ID}) locked: ${gwCounts[String(GW1_LEGACY_ID)] ? "YES (" + gwCounts[String(GW1_LEGACY_ID)] + " rows)" : "NO ⚠️"}`,
  );
}

console.log("\n✅ Read-only precheck complete. No writes performed.");
