/**
 * Import a completed live auction into the online auction pipeline.
 *
 * Creates Auctions row + auction_users (with auth user_id) + auction_teams +
 * seeds competition-scoped lots and marks owned players sold.
 *
 * Usage:
 *   node scripts/setup-online-auction-from-live.mjs --dry-run
 *   node scripts/setup-online-auction-from-live.mjs \
 *     --live-auction-id 7f57087e-4750-4c24-b46f-c9774093518c \
 *     --auction-id 10 \
 *     --name "UEFA Champions League 2026/27 Auction 1" \
 *     --competition-id 4 \
 *     --complete-live-auction
 *
 * Options:
 *   --live-auction-id <uuid>   Source live_auctions.id (required)
 *   --auction-id <n>           Target Auctions.id (required)
 *   --name <text>              Online auction display name
 *   --competition-id <n>       Auctions.competition_id (default 4 = UCL 26/27)
 *   --starting-budget <n>      Default 350
 *   --max-participants <n>     Default 16
 *   --complete-live-auction    Set source live_auctions.status = completed after import
 *   --dry-run                  Validate only; no writes
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

const DEFAULT_STARTING_BUDGET = 350;
const PLACEHOLDER_DEADLINE = "2099-12-31T23:59:59+00:00";

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
    liveAuctionId: null,
    auctionId: null,
    name: null,
    competitionId: 4,
    startingBudget: DEFAULT_STARTING_BUDGET,
    maxParticipants: 16,
    completeLiveAuction: false,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--complete-live-auction") opts.completeLiveAuction = true;
    else if (arg === "--live-auction-id" && argv[i + 1]) opts.liveAuctionId = argv[++i];
    else if (arg === "--auction-id" && argv[i + 1]) opts.auctionId = Number(argv[++i]);
    else if (arg === "--name" && argv[i + 1]) opts.name = argv[++i];
    else if (arg === "--competition-id" && argv[i + 1]) opts.competitionId = Number(argv[++i]);
    else if (arg === "--starting-budget" && argv[i + 1]) opts.startingBudget = Number(argv[++i]);
    else if (arg === "--max-participants" && argv[i + 1]) opts.maxParticipants = Number(argv[++i]);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  if (!opts.liveAuctionId || !opts.auctionId || !opts.name) {
    console.error("❌  Required: --live-auction-id, --auction-id, --name");
    process.exit(1);
  }

  return opts;
}

async function fetchLiveSales(supabase, liveAuctionId) {
  const { data, error } = await supabase
    .from("live_auction_sales")
    .select(
      `price,
       live_auction_participants!participant_id(id, display_name, user_id, role),
       live_auction_players!player_id(fotmob_player_id, player_name)`,
    )
    .eq("auction_id", liveAuctionId)
    .eq("is_voided", false);

  if (error) throw new Error(`live_auction_sales fetch: ${error.message}`);

  const rows = [];
  for (const sale of data ?? []) {
    const part = sale.live_auction_participants;
    const player = sale.live_auction_players;
    if (!part || part.role !== "participant") continue;
    if (!part.user_id) {
      throw new Error(`Participant "${part.display_name}" has no user_id — link accounts before import.`);
    }
    rows.push({
      participantName: part.display_name,
      userId: part.user_id,
      participantId: part.id,
      fotmobPlayerId: String(player?.fotmob_player_id ?? ""),
      playerName: player?.player_name ?? "?",
      price: sale.price,
    });
  }

  return rows;
}

async function fetchParticipants(supabase, liveAuctionId) {
  const { data, error } = await supabase
    .from("live_auction_participants")
    .select("id, display_name, user_id, role")
    .eq("auction_id", liveAuctionId)
    .eq("role", "participant")
    .not("user_id", "is", null)
    .order("display_name");

  if (error) throw new Error(`live_auction_participants fetch: ${error.message}`);
  return data ?? [];
}

async function validateCompetitionPlayers(supabase, competitionId, playerIds) {
  const unique = [...new Set(playerIds)];
  const found = new Set();
  const batchSize = 200;

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("competition_players")
      .select("player_id")
      .eq("competition_id", competitionId)
      .in("player_id", batch);
    if (error) throw new Error(`competition_players lookup: ${error.message}`);
    for (const row of data ?? []) found.add(String(row.player_id));
  }

  const missing = unique.filter((id) => !found.has(id));
  return { missing, foundCount: found.size };
}

function summarize(rows, participants, startingBudget) {
  const spendByName = new Map();
  for (const p of participants) spendByName.set(p.display_name, 0);
  for (const row of rows) {
    spendByName.set(row.participantName, (spendByName.get(row.participantName) ?? 0) + row.price);
  }

  console.log("\nParticipants:");
  console.log("name".padEnd(28), "players".padStart(7), "spent".padStart(6), "remaining".padStart(10));
  console.log("-".repeat(55));

  const playerCountByName = new Map();
  for (const row of rows) {
    playerCountByName.set(row.participantName, (playerCountByName.get(row.participantName) ?? 0) + 1);
  }

  for (const p of participants) {
    const spent = spendByName.get(p.display_name) ?? 0;
    const count = playerCountByName.get(p.display_name) ?? 0;
    console.log(
      p.display_name.padEnd(28),
      String(count).padStart(7),
      String(spent).padStart(6),
      String(startingBudget - spent).padStart(10),
    );
  }
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

  const { data: liveAuction, error: liveErr } = await supabase
    .from("live_auctions")
    .select("id, name, status")
    .eq("id", opts.liveAuctionId)
    .maybeSingle();
  if (liveErr) throw new Error(liveErr.message);
  if (!liveAuction) throw new Error(`Live auction not found: ${opts.liveAuctionId}`);

  const { data: existingOnline } = await supabase
    .from("Auctions")
    .select("id, name")
    .eq("id", opts.auctionId)
    .maybeSingle();
  if (existingOnline) {
    throw new Error(`Auction id ${opts.auctionId} already exists: "${existingOnline.name}"`);
  }

  const participants = await fetchParticipants(supabase, opts.liveAuctionId);
  const salesRows = await fetchLiveSales(supabase, opts.liveAuctionId);

  console.log(`\n📋  Live auction: ${liveAuction.name} (${liveAuction.id})`);
  console.log(`🎯  Online auction: ${opts.name} (id=${opts.auctionId}, competition=${opts.competitionId})`);
  console.log(`👥  Participants: ${participants.length}`);
  console.log(`⚽  Sales: ${salesRows.length}`);

  summarize(salesRows, participants, opts.startingBudget);

  const playerIds = salesRows.map((r) => r.fotmobPlayerId).filter(Boolean);
  const { missing, foundCount } = await validateCompetitionPlayers(
    supabase,
    opts.competitionId,
    playerIds,
  );

  if (missing.length) {
    console.error(`\n❌  ${missing.length} player id(s) not in competition_players (competition ${opts.competitionId}):`);
    for (const id of missing.slice(0, 20)) {
      const row = salesRows.find((r) => r.fotmobPlayerId === id);
      console.error(`   ${id} — ${row?.playerName ?? "?"}`);
    }
    process.exit(1);
  }
  console.log(`\n✅  All ${foundCount} sold player ids found in competition_players`);

  if (opts.dryRun) {
    console.log("\n🏁  Dry run complete — no database writes.");
    return;
  }

  const joinCode = Math.random().toString(36).slice(2, 10).toUpperCase();
  const { data: auction, error: createErr } = await supabase
    .from("Auctions")
    .insert({
      id: opts.auctionId,
      name: opts.name,
      is_active: true,
      hard_deadline_at: PLACEHOLDER_DEADLINE,
      join_code: joinCode,
      max_participants: opts.maxParticipants,
      competition_id: opts.competitionId,
    })
    .select("id, name, join_code")
    .single();
  if (createErr) throw new Error(`Auction insert failed: ${createErr.message}`);
  console.log(`\n✅  Created online auction id=${auction.id} join_code=${auction.join_code}`);

  const spendByName = new Map();
  for (const p of participants) spendByName.set(p.display_name, 0);
  for (const row of salesRows) {
    spendByName.set(row.participantName, (spendByName.get(row.participantName) ?? 0) + row.price);
  }

  const usersPayload = participants.map((p) => {
    const spent = spendByName.get(p.display_name) ?? 0;
    const remaining = opts.startingBudget - spent;
    return {
      auction_id: opts.auctionId,
      name: p.display_name,
      user_id: p.user_id,
      budget_remaining: remaining,
      active_budget: remaining,
    };
  });

  const { data: insertedUsers, error: usersErr } = await supabase
    .from("auction_users")
    .insert(usersPayload)
    .select("id, name, user_id, budget_remaining");
  if (usersErr) throw new Error(`auction_users insert failed: ${usersErr.message}`);
  console.log(`✅  Inserted ${insertedUsers?.length ?? 0} auction_users (user_id linked)`);

  const userIdByName = new Map((insertedUsers ?? []).map((u) => [u.name, u.id]));

  const teamsPayload = salesRows.map((row) => {
    const auctionUserId = userIdByName.get(row.participantName);
    if (!auctionUserId) {
      throw new Error(`No auction_user for participant: ${row.participantName}`);
    }
    return {
      auction_id: opts.auctionId,
      auction_user_id: auctionUserId,
      player_id: row.fotmobPlayerId,
      purchase_price: row.price,
    };
  });

  const { error: teamsErr } = await supabase.from("auction_teams").insert(teamsPayload);
  if (teamsErr) throw new Error(`auction_teams insert failed: ${teamsErr.message}`);
  console.log(`✅  Inserted ${teamsPayload.length} auction_teams rows`);

  const { data: seedResult, error: seedErr } = await supabase.rpc("seed_auction_lots_for_auction", {
    p_auction_id: opts.auctionId,
  });
  if (seedErr) {
    throw new Error(`seed_auction_lots_for_auction failed: ${seedErr.message}`);
  }
  console.log(`✅  Seeded lots:`, seedResult);

  const soldPlayerIds = [...new Set(teamsPayload.map((t) => t.player_id))];
  const { error: soldErr } = await supabase
    .from("auction_lots")
    .update({
      status: "sold",
      expires_at: null,
      current_high_bid_id: null,
      current_high_bidder_id: null,
    })
    .eq("auction_id", opts.auctionId)
    .in("player_id", soldPlayerIds);
  if (soldErr) throw new Error(`Mark sold lots failed: ${soldErr.message}`);
  console.log(`✅  Marked ${soldPlayerIds.length} lots as sold`);

  if (opts.completeLiveAuction) {
    const { error: completeErr } = await supabase
      .from("live_auctions")
      .update({ status: "completed" })
      .eq("id", opts.liveAuctionId);
    if (completeErr) throw new Error(`Complete live auction failed: ${completeErr.message}`);
    console.log(`✅  Marked live auction "${liveAuction.name}" as completed`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hfwauction.vercel.app";
  console.log("\n════════════════════════════════════════════════════════════");
  console.log(`  ${opts.name}`);
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  Online auction id:  ${opts.auctionId}`);
  console.log(`  Join code:          ${auction.join_code} (for new members only — existing owners are linked)`);
  console.log(`  Participants:       ${insertedUsers?.length ?? 0}`);
  console.log(`  Squad rows:         ${teamsPayload.length}`);
  console.log(`  Competition id:     ${opts.competitionId}`);
  console.log("────────────────────────────────────────────────────────────");
  console.log(`  Dashboard:          ${appUrl}/dashboard`);
  console.log(`  Team view:          ${appUrl}/auctions/${opts.auctionId}/team`);
  console.log(`  Bidding room:       ${appUrl}/auctions/${opts.auctionId}/bidding-room`);
  console.log("════════════════════════════════════════════════════════════");
  console.log("\nBidding not opened yet (placeholder deadline). Verify squads before opening.\n");
}

main().catch((err) => {
  console.error("\n❌ ", err.message || err);
  process.exit(1);
});
