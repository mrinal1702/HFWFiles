import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

const TARGET_AUCTION_ID = Number(process.argv[2] || 1);
const TARGET_GW_ID = Number(process.argv[3] || 2);

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
    if (!process.env[key]) process.env[key] = value;
  }
}

function toBatches(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function resolveTableName(supabase, candidates) {
  for (const name of candidates) {
    const res = await supabase.from(name).select("*").limit(1);
    if (!res.error || !String(res.error.message || "").includes("schema cache")) {
      return name;
    }
  }
  return null;
}

async function resolveColumnName(supabase, tableName, candidates) {
  for (const col of candidates) {
    const res = await supabase.from(tableName).select(col).limit(1);
    if (!res.error) return col;
    if (!String(res.error.message || "").includes("does not exist")) continue;
  }
  return null;
}

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Need NEXT_PUBLIC_SUPABASE_URL and key (prefer SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  if (!Number.isFinite(TARGET_AUCTION_ID) || !Number.isFinite(TARGET_GW_ID)) {
    throw new Error(`Invalid args auction_id=${TARGET_AUCTION_ID}, game_week_id=${TARGET_GW_ID}`);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const scoreTable = await resolveTableName(supabase, ["Player_Scores", "player_scores"]);
  const breakdownTable = await resolveTableName(supabase, [
    "auction_score_breakdown",
    "Auction_Score_Breakdown",
  ]);
  const leaderboardTable = await resolveTableName(supabase, [
    "auction_leaderboard",
    "Auction_Leaderboard",
  ]);
  if (!scoreTable) throw new Error("Could not find player scores table.");
  if (!breakdownTable || !leaderboardTable) {
    throw new Error(
      "New scoring tables not found. Run scripts/create-auction-score-tables.sql in Supabase SQL Editor first.",
    );
  }

  const scorePlayerCol = await resolveColumnName(supabase, scoreTable, ["player_id", "Player_ID"]);
  const scoreGwCol = await resolveColumnName(supabase, scoreTable, ["game_week_id", "Game_Week_ID", "gw_id"]);
  const scoreValCol = await resolveColumnName(supabase, scoreTable, ["Score", "score", "Points", "points"]);
  if (!scorePlayerCol || !scoreGwCol || !scoreValCol) {
    throw new Error(
      `Could not resolve score columns. player=${scorePlayerCol}, gw=${scoreGwCol}, value=${scoreValCol}`,
    );
  }

  const usersRes = await supabase
    .from("auction_users")
    .select("id")
    .eq("auction_id", TARGET_AUCTION_ID);
  if (usersRes.error) throw new Error(`auction_users fetch failed: ${usersRes.error.message}`);
  const auctionUserIds = (usersRes.data || []).map((u) => u.id);
  if (!auctionUserIds.length) {
    throw new Error(`No auction users found for auction_id=${TARGET_AUCTION_ID}`);
  }

  const teamsRes = await supabase
    .from("auction_teams")
    .select("auction_user_id,player_id")
    .eq("auction_id", TARGET_AUCTION_ID)
    .in("auction_user_id", auctionUserIds);
  if (teamsRes.error) throw new Error(`auction_teams fetch failed: ${teamsRes.error.message}`);
  const teamRows = teamsRes.data || [];
  if (!teamRows.length) {
    throw new Error(`No auction_teams rows found for auction_id=${TARGET_AUCTION_ID}`);
  }

  const uniquePlayerIds = [...new Set(teamRows.map((r) => String(r.player_id)).filter(Boolean))];
  const scoresByPlayer = new Map();
  for (const batch of toBatches(uniquePlayerIds, 300)) {
    const scoresRes = await supabase
      .from(scoreTable)
      .select(`${scorePlayerCol},${scoreValCol}`)
      .eq(scoreGwCol, TARGET_GW_ID)
      .in(scorePlayerCol, batch);
    if (scoresRes.error) throw new Error(`scores fetch failed: ${scoresRes.error.message}`);
    for (const row of scoresRes.data || []) {
      scoresByPlayer.set(String(row[scorePlayerCol]), Number(row[scoreValCol] ?? 0));
    }
  }

  const breakdownPayload = teamRows.map((r) => ({
    auction_id: TARGET_AUCTION_ID,
    auction_user_id: r.auction_user_id,
    player_id: String(r.player_id),
    game_week_id: TARGET_GW_ID,
    score: Number(scoresByPlayer.get(String(r.player_id)) ?? 0),
  }));

  const delBreakdown = await supabase
    .from(breakdownTable)
    .delete()
    .eq("auction_id", TARGET_AUCTION_ID)
    .eq("game_week_id", TARGET_GW_ID);
  if (delBreakdown.error) throw new Error(`breakdown delete failed: ${delBreakdown.error.message}`);

  for (const batch of toBatches(breakdownPayload, 500)) {
    const ins = await supabase.from(breakdownTable).insert(batch);
    if (ins.error) throw new Error(`breakdown insert failed: ${ins.error.message}`);
  }

  const totalsByUser = new Map();
  for (const row of breakdownPayload) {
    totalsByUser.set(
      row.auction_user_id,
      Number(totalsByUser.get(row.auction_user_id) ?? 0) + Number(row.score),
    );
  }
  const leaderboardPayload = [...totalsByUser.entries()].map(([auctionUserId, total]) => ({
    auction_id: TARGET_AUCTION_ID,
    auction_user_id: auctionUserId,
    game_week_id: TARGET_GW_ID,
    total_score: total,
  }));

  const delLeaderboard = await supabase
    .from(leaderboardTable)
    .delete()
    .eq("auction_id", TARGET_AUCTION_ID)
    .eq("game_week_id", TARGET_GW_ID);
  if (delLeaderboard.error) throw new Error(`leaderboard delete failed: ${delLeaderboard.error.message}`);

  const insLeaderboard = await supabase.from(leaderboardTable).insert(leaderboardPayload);
  if (insLeaderboard.error) throw new Error(`leaderboard insert failed: ${insLeaderboard.error.message}`);

  console.log(`Populated ${breakdownTable}: ${breakdownPayload.length} rows`);
  console.log(`Populated ${leaderboardTable}: ${leaderboardPayload.length} rows`);
  console.log(`Auction=${TARGET_AUCTION_ID}, game_week_id=${TARGET_GW_ID}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
