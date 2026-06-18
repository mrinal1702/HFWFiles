/**
 * Publish local Best XI JSON (from compute_auction_best_xi.py) to Supabase.
 *
 * Writes:
 *   - gameweek_squads.is_best_xi  (true = Starting XI, false = bench)
 *   - auction_leaderboard.total_score  (Best XI total only)
 *
 * Usage:
 *   node scripts/publish-best-xi-from-json.mjs --auction-id 6 --gw-id 1
 *   node scripts/publish-best-xi-from-json.mjs --auction-id 6 --gw-id 1 --json ../Scores/best_xi_auction_6_gw1.json
 *   node scripts/publish-best-xi-from-json.mjs --auction-id 5 --gw-id 1 --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(appRoot, "..");

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing auction-app/.env.local");
  }
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const opts = {
    auctionId: null,
    gwId: 1,
    jsonPath: null,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--auction-id" && argv[i + 1]) opts.auctionId = Number(argv[++i]);
    else if (arg === "--gw-id" && argv[i + 1]) opts.gwId = Number(argv[++i]);
    else if (arg === "--json" && argv[i + 1]) opts.jsonPath = argv[++i];
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  if (!Number.isFinite(opts.auctionId) || opts.auctionId < 1) {
    console.error("❌  --auction-id is required");
    process.exit(1);
  }
  if (!opts.jsonPath) {
    opts.jsonPath = path.join(
      workspaceRoot,
      "Scores",
      `best_xi_auction_${opts.auctionId}_gw${opts.gwId}.json`,
    );
  }
  return opts;
}

async function main() {
  loadEnvLocal();
  const opts = parseArgs(process.argv);

  const jsonPath = path.resolve(opts.jsonPath);
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON not found: ${jsonPath}\nRun compute_auction_best_xi.py first.`);
  }

  const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const managers = payload.managers ?? [];
  if (!managers.length) throw new Error("No managers in JSON");

  if (payload.auction_id != null && Number(payload.auction_id) !== opts.auctionId) {
    throw new Error(
      `JSON auction_id=${payload.auction_id} does not match --auction-id ${opts.auctionId}`,
    );
  }
  if (payload.gw_id != null && Number(payload.gw_id) !== opts.gwId) {
    throw new Error(`JSON gw_id=${payload.gw_id} does not match --gw-id ${opts.gwId}`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key);

  const { data: squadRows, error: squadErr } = await supabase
    .from("gameweek_squads")
    .select("id, auction_user_id, player_id")
    .eq("auction_id", opts.auctionId)
    .eq("game_week_id", opts.gwId);
  if (squadErr) throw new Error(`gameweek_squads fetch: ${squadErr.message}`);
  if (!squadRows?.length) {
    throw new Error(`No gameweek_squads for auction ${opts.auctionId} GW ${opts.gwId}`);
  }

  const rowsByUser = new Map();
  for (const row of squadRows) {
    const uid = Number(row.auction_user_id);
    if (!rowsByUser.has(uid)) rowsByUser.set(uid, []);
    rowsByUser.get(uid).push(row);
  }

  const xiByUser = new Map(
    managers.map((m) => [Number(m.auction_user_id), new Set((m.best_xi_player_ids ?? []).map(String))]),
  );

  let xiUpdates = 0;
  const updatePlan = [];
  for (const [uid, rows] of rowsByUser) {
    const xiSet = xiByUser.get(uid);
    if (!xiSet) {
      console.warn(`⚠️  No Best XI in JSON for auction_user_id=${uid} — skipping ${rows.length} rows`);
      continue;
    }
    for (const row of rows) {
      const inXi = xiSet.has(String(row.player_id));
      updatePlan.push({ id: row.id, is_best_xi: inXi });
      xiUpdates += 1;
    }
  }

  const leaderboardRows = managers.map((m) => ({
    auction_id: opts.auctionId,
    auction_user_id: Number(m.auction_user_id),
    game_week_id: opts.gwId,
    total_score: Number(m.total_points),
  }));

  console.log(`Auction ${opts.auctionId}, GW ${opts.gwId}`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  Managers: ${managers.length}`);
  console.log(`  gameweek_squads updates: ${xiUpdates}`);
  console.log(`  auction_leaderboard rows: ${leaderboardRows.length}`);

  if (opts.dryRun) {
    console.log("\n🏁  Dry run — no writes.");
    for (const m of [...managers].sort((a, b) => b.total_points - a.total_points)) {
      console.log(`  ${m.user_name}: ${m.total_points} (${m.formation})`);
    }
    return;
  }

  for (const row of updatePlan) {
    const { error } = await supabase
      .from("gameweek_squads")
      .update({ is_best_xi: row.is_best_xi })
      .eq("id", row.id);
    if (error) throw new Error(`gameweek_squads update id=${row.id}: ${error.message}`);
  }
  console.log(`✅  Updated is_best_xi on ${xiUpdates} gameweek_squads rows`);

  const { error: lbDelErr } = await supabase
    .from("auction_leaderboard")
    .delete()
    .eq("auction_id", opts.auctionId)
    .eq("game_week_id", opts.gwId);
  if (lbDelErr) throw new Error(`auction_leaderboard delete: ${lbDelErr.message}`);

  const { error: lbInsErr } = await supabase.from("auction_leaderboard").insert(leaderboardRows);
  if (lbInsErr) throw new Error(`auction_leaderboard insert: ${lbInsErr.message}`);
  console.log(`✅  Inserted ${leaderboardRows.length} auction_leaderboard rows`);

  console.log("\nLeaderboard totals:");
  for (const m of [...managers].sort((a, b) => b.total_points - a.total_points)) {
    console.log(`  ${m.user_name}: ${m.total_points} (${m.formation})`);
  }
  console.log(`\nLive: https://hfwauction.vercel.app/leaderboard/${opts.auctionId}`);
}

main().catch((err) => {
  console.error("\n❌ ", err.message || err);
  process.exit(1);
});
