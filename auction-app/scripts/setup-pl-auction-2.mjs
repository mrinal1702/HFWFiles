/**
 * Sets up "Premier League 2026/27 Auction 2" as a live auction.
 *
 * Usage:
 *   node scripts/setup-pl-auction-2.mjs
 *
 * What it does:
 *   1. Creates a live auction with a join_code (participants join via code, no accounts needed)
 *   2. Looks up Aman Chokshi's account and adds him as admin
 *   3. Seeds all players from the existing `players` table (same pool as the current PL auction)
 *   4. Prints the join code, admin link, and overview link
 *
 * Re-running is safe — checks for existing auction by name.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

const AUCTION_NAME = "Premier League 2026/27 Auction 2";
const STARTING_BUDGET = 350;
const SQUAD_SIZE = 18;
const MIN_BID = 5;

function generateJoinCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 8);
}

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌  .env.local not found at", envPath);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌  Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // ─── 1. Find Aman Chokshi ────────────────────────────────────────────────
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");

  if (profErr) {
    console.error("❌  Could not fetch profiles:", profErr.message);
    process.exit(1);
  }

  console.log("\n👥  All profiles:");
  (profiles ?? []).forEach((p) => console.log(`  • ${p.display_name} (${p.id})`));

  const adminProfile = (profiles ?? []).find(
    (p) => p.display_name?.toLowerCase().includes("aman") || p.display_name?.toLowerCase().includes("chokshi"),
  );

  if (!adminProfile) {
    console.error('❌  Could not find Aman Chokshi in profiles. Available names:', (profiles ?? []).map(p => p.display_name));
    process.exit(1);
  }

  console.log(`\n🔑  Admin: ${adminProfile.display_name} (${adminProfile.id})`);

  // ─── 2. Create or find the live auction ──────────────────────────────────
  let auction;
  const { data: existing, error: findErr } = await supabase
    .from("live_auctions")
    .select("*")
    .eq("name", AUCTION_NAME)
    .maybeSingle();

  if (findErr) {
    console.error("❌  Error checking for existing auction:", findErr.message);
    process.exit(1);
  }

  if (existing) {
    auction = existing;
    console.log(`⚡  Found existing auction: "${AUCTION_NAME}" (${auction.id})`);
  } else {
    const joinCode = generateJoinCode();
    const { data: created, error: createErr } = await supabase
      .from("live_auctions")
      .insert({
        name: AUCTION_NAME,
        status: "setup",
        starting_budget: STARTING_BUDGET,
        squad_size: SQUAD_SIZE,
        min_bid: MIN_BID,
        join_code: joinCode,
        created_by: adminProfile.id,
      })
      .select("*")
      .single();

    if (createErr) {
      console.error("❌  Failed to create auction:", createErr.message);
      process.exit(1);
    }
    auction = created;
    console.log(`✅  Created auction: "${AUCTION_NAME}" (${auction.id})`);
  }

  // ─── 3. Add admin participant ─────────────────────────────────────────────
  const { data: existingAdmin } = await supabase
    .from("live_auction_participants")
    .select("*")
    .eq("auction_id", auction.id)
    .eq("user_id", adminProfile.id)
    .maybeSingle();

  if (existingAdmin) {
    if (existingAdmin.role !== "admin") {
      await supabase
        .from("live_auction_participants")
        .update({ role: "admin" })
        .eq("id", existingAdmin.id);
      console.log(`✅  Promoted ${adminProfile.display_name} to admin`);
    } else {
      console.log(`⚡  Admin already exists: ${adminProfile.display_name}`);
    }
  } else {
    const { error: adminErr } = await supabase.from("live_auction_participants").insert({
      auction_id: auction.id,
      user_id: adminProfile.id,
      display_name: adminProfile.display_name,
      role: "admin",
    });
    if (adminErr) {
      console.error("❌  Failed to insert admin:", adminErr.message);
      process.exit(1);
    }
    console.log(`✅  Added admin: ${adminProfile.display_name}`);
  }

  // ─── 4. Seed players from the players table ──────────────────────────────
  const { data: allPlayers, error: playersErr } = await supabase
    .from("players")
    .select("player_id, player_name, team_name, position")
    .not("team_name", "is", null)
    .order("team_name")
    .order("player_name");

  if (playersErr) {
    console.error("❌  Failed to fetch players:", playersErr.message);
    process.exit(1);
  }

  if (!allPlayers || allPlayers.length === 0) {
    console.warn("⚠️   No players found in players table.");
  } else {
    console.log(`\n🌍  Seeding ${allPlayers.length} players...`);

    const { count: alreadySeeded } = await supabase
      .from("live_auction_players")
      .select("id", { count: "exact", head: true })
      .eq("auction_id", auction.id);

    if (alreadySeeded && alreadySeeded > 0) {
      console.log(`⚡  ${alreadySeeded} already seeded — upserting.`);
    }

    const rows = allPlayers.map((p) => ({
      auction_id: auction.id,
      fotmob_player_id: String(p.player_id),
      player_name: p.player_name,
      team_name: p.team_name ?? null,
      nation: null,
      position: p.position ?? null,
      status: "available",
    }));

    const BATCH_SIZE = 100;
    let totalUpserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { data: upserted, error: upsertErr } = await supabase
        .from("live_auction_players")
        .upsert(batch, { onConflict: "auction_id,fotmob_player_id", ignoreDuplicates: false })
        .select("id");

      if (upsertErr) {
        console.error(`❌  Upsert error (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, upsertErr.message);
        process.exit(1);
      }
      totalUpserted += upserted?.length ?? 0;
    }
    console.log(`✅  ${totalUpserted} player(s) seeded.`);
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log(`🏆  Auction:    "${auction.name}"`);
  console.log(`🆔  ID:         ${auction.id}`);
  console.log(`🔑  Join Code:  ${auction.join_code}`);
  console.log(`💰  Budget:     £${STARTING_BUDGET} | Squad: ${SQUAD_SIZE} | Min bid: £${MIN_BID}`);
  console.log(`👤  Admin:      ${adminProfile.display_name}`);
  console.log("═".repeat(60));
  console.log(`\n🔗  Join page:  https://hfwauction.vercel.app/live-auction/join`);
  console.log(`🔗  Admin:      https://hfwauction.vercel.app/live-auction/${auction.id}/admin`);
  console.log(`🔗  Overview:   https://hfwauction.vercel.app/live-auction/${auction.id}\n`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
