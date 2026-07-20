/**
 * Apply participant relegations (SF cut — cumulative standings after GW7).
 *
 * Prerequisites (Supabase SQL Editor, once):
 *   scripts/sql/participant-relegation-schema.sql
 *   scripts/sql/participant-relegation-rpc.sql
 *
 * Usage:
 *   node scripts/apply-participant-relegations.mjs --dry-run
 *   node scripts/apply-participant-relegations.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

/** auction_id → auction_user_id[] — 3rd & 4th of active standings after SF (GW7). */
const RELEGATIONS = {
  5: [33, 43], // Nicolas Pastore, Sujay Choksey
  6: [53, 61], // Ishaan Shah, Arnav Gupta
  7: [88, 81], // Zahaan Bafna, AZ/Dalla
};

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error("Missing auction-app/.env.local");
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

async function fetchSeasonTotals(supabase, auctionId) {
  const { data, error } = await supabase
    .from("auction_leaderboard")
    .select("auction_user_id, total_score")
    .eq("auction_id", auctionId);
  if (error) throw error;
  const totals = new Map();
  for (const row of data ?? []) {
    const uid = Number(row.auction_user_id);
    totals.set(uid, (totals.get(uid) ?? 0) + Number(row.total_score));
  }
  return totals;
}

async function fetchUserLabel(supabase, userId) {
  const { data } = await supabase
    .from("auction_users")
    .select("name, team_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.team_name?.trim() || data?.name || `user ${userId}`;
}

async function probeSchema(supabase) {
  const { error } = await supabase.from("auction_users").select("is_relegated").limit(1);
  if (error && String(error.message).includes("is_relegated")) {
    return { hasRelegatedColumn: false, hasAuditTable: false };
  }
  if (error) throw error;

  const audit = await supabase.from("auction_participant_relegations").select("id").limit(1);
  const hasAuditTable = !(
    audit.error &&
    (audit.error.code === "PGRST205" || /auction_participant_relegations/.test(audit.error.message ?? ""))
  );
  return { hasRelegatedColumn: true, hasAuditTable };
}

async function relegateUser(supabase, auctionId, userId, meta, dryRun) {
  const label = await fetchUserLabel(supabase, userId);

  const { data: teams, error: tErr } = await supabase
    .from("auction_teams")
    .select("player_id")
    .eq("auction_id", auctionId)
    .eq("auction_user_id", userId);
  if (tErr) throw tErr;

  const playerIds = (teams ?? []).map((t) => String(t.player_id));
  console.log(
    `  ${label} (${userId}): ${playerIds.length} players → pool, budget → 0` +
      (meta ? `, season ${meta.total} pts (rank ${meta.rank})` : ""),
  );

  if (dryRun) return { players: playerIds.length };

  for (const playerId of playerIds) {
    const { error: lotErr } = await supabase
      .from("auction_lots")
      .update({
        status: "uninitiated",
        expires_at: null,
        current_high_bid_id: null,
        current_high_bidder_id: null,
      })
      .eq("auction_id", auctionId)
      .eq("player_id", playerId);
    if (lotErr) throw new Error(`lot ${playerId}: ${lotErr.message}`);
  }

  if (playerIds.length > 0) {
    const { error: delErr } = await supabase
      .from("auction_teams")
      .delete()
      .eq("auction_id", auctionId)
      .eq("auction_user_id", userId);
    if (delErr) throw delErr;
  }

  const userUpdate = {
    budget_remaining: 0,
    active_budget: 0,
    is_relegated: true,
    relegated_at: new Date().toISOString(),
  };
  let { error: uErr } = await supabase.from("auction_users").update(userUpdate).eq("id", userId);
  if (uErr && String(uErr.message).includes("is_relegated")) {
    ({ error: uErr } = await supabase
      .from("auction_users")
      .update({ budget_remaining: 0, active_budget: 0 })
      .eq("id", userId));
  }
  if (uErr) throw uErr;

  if (meta) {
    const { error: aErr } = await supabase.from("auction_participant_relegations").upsert(
      {
        auction_id: auctionId,
        auction_user_id: userId,
        season_total_points: meta.total,
        rank_at_relegation: meta.rank,
      },
      { onConflict: "auction_id,auction_user_id" },
    );
    if (aErr && !/auction_participant_relegations/.test(aErr.message ?? "")) {
      throw aErr;
    }
  }

  return { players: playerIds.length };
}

async function main() {
  loadEnvLocal();
  const { dryRun } = parseArgs(process.argv);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key);
  const schema = await probeSchema(supabase);

  if (!schema.hasRelegatedColumn) {
    console.warn(
      "⚠️  auction_users.is_relegated not found — run scripts/sql/participant-relegation-schema.sql in Supabase SQL Editor.",
    );
    console.warn("   Data apply will still zero budgets and return players; UI uses data/relegated-participants.json.");
  }
  if (!schema.hasRelegatedColumn || !schema.hasAuditTable) {
    console.warn(
      "⚠️  Run scripts/sql/participant-relegation-rpc.sql for bid/release server blocks before next bidding window.",
    );
  }

  console.log(dryRun ? "🏁  Dry run\n" : "Applying relegations…\n");

  let totalPlayers = 0;
  for (const [auctionIdStr, userIds] of Object.entries(RELEGATIONS)) {
    const auctionId = Number(auctionIdStr);
    if (!userIds.length) {
      console.log(`Auction ${auctionId}: no relegations`);
      continue;
    }

    const totals = await fetchSeasonTotals(supabase, auctionId);
    const ranked = [...totals.entries()]
      .map(([id, total]) => ({ id, total }))
      .sort((a, b) => b.total - a.total || a.id - b.id);
    const rankById = new Map(ranked.map((r, i) => [r.id, i + 1]));

    console.log(`Auction ${auctionId}:`);
    for (const userId of userIds) {
      const meta = {
        total: totals.get(userId) ?? 0,
        rank: rankById.get(userId) ?? 0,
      };
      const result = await relegateUser(supabase, auctionId, userId, meta, dryRun);
      totalPlayers += result.players;
    }
    console.log("");
  }

  console.log(
    dryRun
      ? `Would return ${totalPlayers} players to the pool.`
      : `✅  Relegation complete — ${totalPlayers} players returned to uninitiated lots.`,
  );
}

main().catch((err) => {
  console.error("\n❌ ", err.message || err);
  process.exit(1);
});
