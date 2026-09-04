/**
 * Lock a gameweek squad snapshot and open the next GW bidding window for ONE auction.
 * Does not modify other auctions.
 *
 * Usage:
 *   node scripts/setup-auction-gw-state.mjs --dry-run --auction-id 7 --lock-gw 1 --copy-deadlines-from 5
 *   node scripts/setup-auction-gw-state.mjs --auction-id 7 --lock-gw 1 --copy-deadlines-from 5
 *
 * Options:
 *   --auction-id <n>           Target auction (required)
 *   --lock-gw <n>              game_week_id to snapshot from auction_teams (required)
 *   --copy-deadlines-from <n>  Copy initiation/raise/hard deadlines from another auction
 *   --apply-budget-boost       Add +100 to budget_remaining and active_budget (GW1→GW2 once)
 *   --activate-gw              Set Game_Weeks.Is_Active to the locked GW (leaderboard tab)
 *   --dry-run                  Preview only
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
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const opts = {
    auctionId: null,
    lockGw: null,
    copyDeadlinesFrom: null,
    applyBudgetBoost: false,
    activateGw: false,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--apply-budget-boost") opts.applyBudgetBoost = true;
    else if (arg === "--activate-gw") opts.activateGw = true;
    else if (arg === "--auction-id" && argv[i + 1]) opts.auctionId = Number(argv[++i]);
    else if (arg === "--lock-gw" && argv[i + 1]) opts.lockGw = Number(argv[++i]);
    else if (arg === "--copy-deadlines-from" && argv[i + 1]) opts.copyDeadlinesFrom = Number(argv[++i]);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  if (!Number.isFinite(opts.auctionId) || opts.auctionId < 1) {
    console.error("❌  --auction-id is required");
    process.exit(1);
  }
  if (!Number.isFinite(opts.lockGw) || opts.lockGw < 1) {
    console.error("❌  --lock-gw is required");
    process.exit(1);
  }
  return opts;
}

async function main() {
  loadEnvLocal();
  const opts = parseArgs(process.argv);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(url, key);

  const { data: auction, error: aErr } = await supabase
    .from("Auctions")
    .select("id,name,hard_deadline_at,initiation_deadline_at,raise_deadline_at")
    .eq("id", opts.auctionId)
    .maybeSingle();
  if (aErr) throw new Error(aErr.message);
  if (!auction) throw new Error(`Auction id ${opts.auctionId} not found`);

  const { data: gw, error: gwErr } = await supabase
    .from("Game_Weeks")
    .select("id,GW_Name,Is_Active")
    .eq("id", opts.lockGw)
    .maybeSingle();
  if (gwErr) throw new Error(gwErr.message);
  if (!gw) throw new Error(`Game week id ${opts.lockGw} not found`);

  const { data: teams, error: tErr } = await supabase
    .from("auction_teams")
    .select("auction_user_id,player_id,purchase_price")
    .eq("auction_id", opts.auctionId);
  if (tErr) throw new Error(tErr.message);
  if (!teams?.length) throw new Error(`No auction_teams rows for auction ${opts.auctionId}`);

  const { count: existingSnap } = await supabase
    .from("gameweek_squads")
    .select("*", { count: "exact", head: true })
    .eq("auction_id", opts.auctionId)
    .eq("game_week_id", opts.lockGw);

  let deadlineSource = null;
  if (opts.copyDeadlinesFrom != null) {
    const { data: src, error: sErr } = await supabase
      .from("Auctions")
      .select("id,name,hard_deadline_at,initiation_deadline_at,raise_deadline_at")
      .eq("id", opts.copyDeadlinesFrom)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!src) throw new Error(`copy-deadlines-from auction ${opts.copyDeadlinesFrom} not found`);
    deadlineSource = src;
  }

  const byUser = new Map();
  for (const row of teams) {
    byUser.set(row.auction_user_id, (byUser.get(row.auction_user_id) ?? 0) + 1);
  }

  console.log(`Target auction: ${auction.name} (id=${auction.id})`);
  console.log(`Lock GW: ${gw.GW_Name} (id=${gw.id}, Is_Active=${gw.Is_Active})`);
  console.log(`Squad rows to lock: ${teams.length} (${byUser.size} managers)`);
  console.log(`Existing gameweek_squads for this GW: ${existingSnap ?? 0}`);

  if (deadlineSource) {
    console.log(`\nCopy deadlines from: ${deadlineSource.name} (id=${deadlineSource.id})`);
    console.log(`  initiation_deadline_at: ${deadlineSource.initiation_deadline_at}`);
    console.log(`  raise_deadline_at:      ${deadlineSource.raise_deadline_at}`);
    console.log(`  hard_deadline_at:       ${deadlineSource.hard_deadline_at}`);
  }

  if (opts.applyBudgetBoost) {
    console.log("\nWill apply +100 budget boost to all auction_users on this auction");
  }

  if (opts.activateGw) {
    console.log(`\nWill set Game_Weeks.Is_Active = true for GW${opts.lockGw} (others false)`);
  }

  if (opts.dryRun) {
    console.log("\n🏁  Dry run — no writes.");
    return;
  }

  if ((existingSnap ?? 0) > 0) {
    console.log(`\n⚡  GW${opts.lockGw} snapshot already exists — skipping insert (idempotent).`);
  } else {
    const payload = teams.map((row) => ({
      auction_id: opts.auctionId,
      game_week_id: opts.lockGw,
      auction_user_id: row.auction_user_id,
      player_id: String(row.player_id),
      purchase_price: row.purchase_price,
    }));

    const { error: insErr } = await supabase.from("gameweek_squads").insert(payload);
    if (insErr) throw new Error(`gameweek_squads insert: ${insErr.message}`);
    console.log(`\n✅  Locked ${payload.length} rows into gameweek_squads (GW${opts.lockGw})`);
  }

  if (deadlineSource) {
    const { error: relErr } = await supabase
      .from("auction_users")
      .update({ paid_release_used: false })
      .eq("auction_id", opts.auctionId);
    if (relErr) throw new Error(`paid_release reset: ${relErr.message}`);
    console.log("✅  Reset paid_release_used = false for all managers");
  }

  if (opts.applyBudgetBoost) {
    const { data: users, error: uErr } = await supabase
      .from("auction_users")
      .select("id,budget_remaining,active_budget")
      .eq("auction_id", opts.auctionId);
    if (uErr) throw new Error(uErr.message);

    for (const u of users ?? []) {
      const { error: bErr } = await supabase
        .from("auction_users")
        .update({
          budget_remaining: u.budget_remaining + 100,
          active_budget: u.active_budget + 100,
        })
        .eq("id", u.id);
      if (bErr) throw new Error(`budget boost for user ${u.id}: ${bErr.message}`);
    }
    console.log(`✅  Applied +100 budget boost to ${users?.length ?? 0} managers`);
  }

  if (deadlineSource) {
    const { error: dErr } = await supabase
      .from("Auctions")
      .update({
        initiation_deadline_at: deadlineSource.initiation_deadline_at,
        raise_deadline_at: deadlineSource.raise_deadline_at,
        hard_deadline_at: deadlineSource.hard_deadline_at,
        is_active: true,
      })
      .eq("id", opts.auctionId);
    if (dErr) throw new Error(`deadline update: ${dErr.message}`);
    console.log("✅  Next GW bidding deadlines copied to target auction");
  }

  if (opts.activateGw) {
    const { error: deactivateErr } = await supabase
      .from("Game_Weeks")
      .update({ Is_Active: false })
      .eq("Is_Active", true);
    if (deactivateErr) throw new Error(`Game_Weeks deactivate: ${deactivateErr.message}`);

    const { error: activateErr } = await supabase
      .from("Game_Weeks")
      .update({ Is_Active: true })
      .eq("id", opts.lockGw);
    if (activateErr) throw new Error(`Game_Weeks activate GW${opts.lockGw}: ${activateErr.message}`);
    console.log(`✅  Game_Weeks.Is_Active set to GW${opts.lockGw}`);
  }

  const { count: snapCount } = await supabase
    .from("gameweek_squads")
    .select("*", { count: "exact", head: true })
    .eq("auction_id", opts.auctionId)
    .eq("game_week_id", opts.lockGw);

  const { data: scores } = await supabase
    .from("player_scores")
    .select("player_id")
    .eq("game_week_id", opts.lockGw);
  const scoreIds = new Set((scores ?? []).map((r) => String(r.player_id)));
  const rosterIds = [...new Set(teams.map((t) => String(t.player_id)))];
  const overlap = rosterIds.filter((id) => scoreIds.has(id));

  console.log(`\nSummary:`);
  console.log(`  gameweek_squads locked: ${snapCount}`);
  console.log(`  GW${opts.lockGw} player_scores in DB: ${scoreIds.size}`);
  console.log(`  Auction roster players with scores so far: ${overlap.length}/${rosterIds.length}`);
  console.log(`\nLeaderboard → This Gameweek will show locked GW${opts.lockGw} squads with per-player scores as uploaded.`);
  if (deadlineSource) {
    console.log(`Next GW bidding is open until hard_deadline_at (same as auction ${deadlineSource.id}).`);
  }
}

main().catch((err) => {
  console.error("\n❌ ", err.message || err);
  process.exit(1);
});
