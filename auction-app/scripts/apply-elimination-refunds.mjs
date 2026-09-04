/**
 * Apply elimination refunds across WC auctions (commissioner tool).
 *
 * Usage:
 *   node scripts/apply-elimination-refunds.mjs --dry-run Haiti Turkiye Tunisia
 *   node scripts/apply-elimination-refunds.mjs Haiti Turkiye Tunisia
 *
 * Options:
 *   --dry-run          Preview only (no writes)
 *   --auction-ids 5,6,7  Override auction ids (default: 5,6,7)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

const DEFAULT_AUCTION_IDS = [5, 6, 7];

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
  const opts = { dryRun: false, auctionIds: DEFAULT_AUCTION_IDS, teams: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--auction-ids") {
      opts.auctionIds = argv[++i].split(",").map((n) => Number(n.trim()));
    } else if (!arg.startsWith("--")) {
      opts.teams.push(arg);
    }
  }
  return opts;
}

function refundAmount(purchasePrice) {
  return Math.floor((purchasePrice + 1) / 2);
}

async function fetchAlreadyRefunded(supabase, auctionIds) {
  const { data, error } = await supabase
    .from("auction_elimination_refunds")
    .select("auction_id, player_id")
    .in("auction_id", auctionIds);
  if (error) {
    // Table may not exist yet — idempotency still holds via auction_teams removal.
    if (error.code === "PGRST205" || /auction_elimination_refunds/.test(error.message ?? "")) {
      console.warn("⚠️  auction_elimination_refunds table not found — skipping audit dedupe.");
      return new Set();
    }
    throw error;
  }
  const set = new Set((data ?? []).map((r) => `${r.auction_id}:${r.player_id}`));
  return set;
}

async function fetchTargets(supabase, auctionIds, eliminatedTeams, refundedSet) {
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("player_id, player_name, team_name")
    .in("team_name", eliminatedTeams);
  if (pErr) throw pErr;
  if (!players?.length) return [];

  const playerById = new Map(players.map((p) => [String(p.player_id), p]));
  const playerIds = players.map((p) => String(p.player_id));

  const { data: teams, error: tErr } = await supabase
    .from("auction_teams")
    .select("auction_id, auction_user_id, player_id, purchase_price")
    .in("auction_id", auctionIds)
    .in("player_id", playerIds);
  if (tErr) throw tErr;
  if (!teams?.length) return [];

  const userIds = [...new Set(teams.map((t) => t.auction_user_id))];
  const { data: users, error: uErr } = await supabase
    .from("auction_users")
    .select("id, name, auction_id")
    .in("id", userIds);
  if (uErr) throw uErr;
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  return teams
    .filter((t) => !refundedSet.has(`${t.auction_id}:${String(t.player_id)}`))
    .map((t) => {
      const p = playerById.get(String(t.player_id));
      const u = userById.get(t.auction_user_id);
      return {
        auction_id: t.auction_id,
        auction_user_id: t.auction_user_id,
        player_id: String(t.player_id),
        purchase_price: t.purchase_price,
        team_name: p?.team_name ?? "?",
        player_name: p?.player_name ?? "?",
        manager: u?.name ?? "?",
        refund_amount: refundAmount(t.purchase_price),
      };
    });
}

async function fetchOpenBids(supabase, auctionIds, eliminatedTeams) {
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("player_id, player_name, team_name")
    .in("team_name", eliminatedTeams);
  if (pErr) throw pErr;
  if (!players?.length) return [];

  const playerIds = players.map((p) => String(p.player_id));

  const { data: lots, error: lErr } = await supabase
    .from("auction_lots")
    .select("auction_id, player_id, current_high_bidder_id, current_high_bid_id, status")
    .in("auction_id", auctionIds)
    .in("player_id", playerIds)
    .eq("status", "bidding");
  if (lErr) throw lErr;
  if (!lots?.length) return [];

  const bidIds = lots.map((l) => l.current_high_bid_id).filter(Boolean);
  const { data: bids, error: bErr } = await supabase
    .from("auction_bids")
    .select("id, amount")
    .in("id", bidIds);
  if (bErr) throw bErr;
  const bidById = new Map((bids ?? []).map((b) => [b.id, b.amount]));

  const bidderIds = [...new Set(lots.map((l) => l.current_high_bidder_id).filter(Boolean))];
  const { data: users, error: uErr } = await supabase
    .from("auction_users")
    .select("id, name")
    .in("id", bidderIds);
  if (uErr) throw uErr;
  const userById = new Map((users ?? []).map((u) => [u.id, u.name]));

  const playerById = new Map(players.map((p) => [String(p.player_id), p]));

  return lots
    .filter((l) => l.current_high_bidder_id && l.current_high_bid_id)
    .map((l) => ({
      auction_id: l.auction_id,
      player_id: l.player_id,
      player_name: playerById.get(String(l.player_id))?.player_name ?? "?",
      team_name: playerById.get(String(l.player_id))?.team_name ?? "?",
      high_bidder: userById.get(l.current_high_bidder_id) ?? "?",
      bid_amount: bidById.get(l.current_high_bid_id) ?? 0,
    }));
}

async function applyRefunds(supabase, targets, openBids) {
  if (!targets.length && !openBids.length) {
    console.log("Nothing to apply — all already processed or no owners.");
    return;
  }

  // 1) Log refunds
  if (targets.length) {
    const rows = targets.map((t) => ({
      auction_id: t.auction_id,
      auction_user_id: t.auction_user_id,
      player_id: t.player_id,
      team_name: t.team_name,
      purchase_price: t.purchase_price,
      refund_amount: t.refund_amount,
    }));
    const { error } = await supabase.from("auction_elimination_refunds").insert(rows);
    if (error) {
      if (error.code === "PGRST205" || /auction_elimination_refunds/.test(error.message ?? "")) {
        console.warn("⚠️  auction_elimination_refunds table not found — refunds applied without audit log.");
      } else {
        throw error;
      }
    }
  }

  // 2) Credit budgets (aggregate per user)
  const refundByUser = new Map();
  for (const t of targets) {
    refundByUser.set(
      t.auction_user_id,
      (refundByUser.get(t.auction_user_id) ?? 0) + t.refund_amount,
    );
  }

  for (const [userId, total] of refundByUser) {
    const { data: user, error: gErr } = await supabase
      .from("auction_users")
      .select("budget_remaining, active_budget")
      .eq("id", userId)
      .single();
    if (gErr) throw gErr;
    const { error: uErr } = await supabase
      .from("auction_users")
      .update({
        budget_remaining: user.budget_remaining + total,
        active_budget: user.active_budget + total,
      })
      .eq("id", userId);
    if (uErr) throw uErr;
  }

  // 3) Remove from squads
  for (const t of targets) {
    const { error } = await supabase
      .from("auction_teams")
      .delete()
      .eq("auction_id", t.auction_id)
      .eq("auction_user_id", t.auction_user_id)
      .eq("player_id", t.player_id);
    if (error) throw error;
  }

  // 4) Close owned lots
  const ownedLotKeys = new Set(targets.map((t) => `${t.auction_id}:${t.player_id}`));
  for (const key of ownedLotKeys) {
    const [auctionId, playerId] = key.split(":");
    const { error } = await supabase
      .from("auction_lots")
      .update({
        status: "unsold",
        expires_at: null,
        current_high_bid_id: null,
        current_high_bidder_id: null,
      })
      .eq("auction_id", Number(auctionId))
      .eq("player_id", playerId);
    if (error) throw error;
  }

  // 5) Release open bid reserves + close bidding lots
  const bidReleaseByUser = new Map();

  // Re-fetch lots for bidder ids
  const playerIdsFromBids = [...new Set(openBids.map((b) => b.player_id))];
  if (playerIdsFromBids.length) {
    const auctionIds = [...new Set(openBids.map((b) => b.auction_id))];
    const { data: lots, error: lErr } = await supabase
      .from("auction_lots")
      .select("auction_id, player_id, current_high_bidder_id, current_high_bid_id")
      .in("auction_id", auctionIds)
      .in("player_id", playerIdsFromBids)
      .eq("status", "bidding");
    if (lErr) throw lErr;

    for (const lot of lots ?? []) {
      if (!lot.current_high_bidder_id || !lot.current_high_bid_id) continue;
      const ob = openBids.find(
        (b) => b.auction_id === lot.auction_id && b.player_id === lot.player_id,
      );
      if (!ob) continue;
      bidReleaseByUser.set(
        lot.current_high_bidder_id,
        (bidReleaseByUser.get(lot.current_high_bidder_id) ?? 0) + ob.bid_amount,
      );
    }

    for (const [userId, total] of bidReleaseByUser) {
      const { data: user, error: gErr } = await supabase
        .from("auction_users")
        .select("active_budget")
        .eq("id", userId)
        .single();
      if (gErr) throw gErr;
      const { error: uErr } = await supabase
        .from("auction_users")
        .update({ active_budget: user.active_budget + total })
        .eq("id", userId);
      if (uErr) throw uErr;
    }

    for (const lot of lots ?? []) {
      const { error } = await supabase
        .from("auction_lots")
        .update({
          status: "unsold",
          expires_at: null,
          current_high_bid_id: null,
          current_high_bidder_id: null,
        })
        .eq("auction_id", lot.auction_id)
        .eq("player_id", lot.player_id);
      if (error) throw error;
    }
  }

  console.log("\n✅ Applied:");
  console.log(`   players_refunded: ${targets.length}`);
  console.log(`   total_refunded: £${targets.reduce((s, t) => s + t.refund_amount, 0)}`);
  console.log(`   open_bids_cancelled: ${openBids.length}`);
}

function printPreview(targets, openBids) {
  console.log("\n── Owned players to refund ──");
  if (!targets.length) {
    console.log("  (none — already processed or no owners)");
  } else {
    let total = 0;
    for (const t of targets.sort(
      (a, b) =>
        a.auction_id - b.auction_id ||
        a.team_name.localeCompare(b.team_name) ||
        a.manager.localeCompare(b.manager),
    )) {
      console.log(
        `  [A${t.auction_id}] ${t.manager} | ${t.team_name} — ${t.player_name} | paid £${t.purchase_price} → refund £${t.refund_amount}`,
      );
      total += t.refund_amount;
    }
    console.log(`  TOTAL: ${targets.length} players, £${total} refunded`);
  }

  console.log("\n── Open bids to cancel ──");
  if (!openBids.length) {
    console.log("  (none)");
  } else {
    for (const b of openBids) {
      console.log(
        `  [A${b.auction_id}] ${b.high_bidder} bidding on ${b.team_name} — ${b.player_name} | reserve £${b.bid_amount} released`,
      );
    }
  }
}

async function main() {
  loadEnvLocal();
  const opts = parseArgs(process.argv);

  if (!opts.teams.length) {
    console.error("Usage: node scripts/apply-elimination-refunds.mjs [--dry-run] Team1 Team2 ...");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const refundedSet = await fetchAlreadyRefunded(supabase, opts.auctionIds);
  const targets = await fetchTargets(supabase, opts.auctionIds, opts.teams, refundedSet);
  const openBids = await fetchOpenBids(supabase, opts.auctionIds, opts.teams);

  console.log(`Eliminated nations: ${opts.teams.join(", ")}`);
  console.log(`Auctions: ${opts.auctionIds.join(", ")}`);
  console.log(opts.dryRun ? "\n🔍 DRY RUN" : "\n⚡ APPLYING");

  printPreview(targets, openBids);

  if (!opts.dryRun) {
    await applyRefunds(supabase, targets, openBids);
  }
}

main().catch((err) => {
  console.error("❌", err.message ?? err);
  process.exit(1);
});
