/**
 * Sets up a World Cup 2026 drill live auction.
 *
 * Usage:
 *   node scripts/setup-drill-auction.mjs
 *
 * What it does:
 *   1. Lists all users in profiles so you can see who's in the DB
 *   2. Creates a live auction named "WC 2026 Drill"
 *   3. Adds Conrad, DD, and Nimai as participants
 *   4. Sets the first admin user (trive / yourself) as admin
 *   5. Seeds all WC 2026 players from the players table
 *
 * Re-running is safe — it checks for an existing auction with the same name.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

const AUCTION_NAME = process.argv[2] || "WC 2026 Drill";
const STARTING_BUDGET = 350;
const SQUAD_SIZE = 18;
const MIN_BID = 5;

// Participants to add (no linked user accounts — placeholders)
const PARTICIPANTS = ["Conrad", "DD", "Nimai"];

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

  // ─── 1. List existing users ───────────────────────────────────────────────
  console.log("\n👥  Existing user profiles:\n");
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");

  if (profilesErr) {
    console.error("❌  Could not fetch profiles:", profilesErr.message);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.warn("⚠️   No profiles found — admin will be set without a user_id link.");
  } else {
    profiles.forEach((p) => console.log(`  • ${p.display_name} (${p.id})`));
  }

  // Treat the first profile as the admin (adjust if needed)
  const adminProfile = profiles?.[0] ?? null;
  if (adminProfile) {
    console.log(`\n🔑  Admin will be: ${adminProfile.display_name} (${adminProfile.id})\n`);
  } else {
    console.log("\n🔑  No profile found — admin row created without user_id\n");
  }

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
    console.log(`⚡  Found existing auction: "${AUCTION_NAME}" (${existing.id})`);
    auction = existing;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("live_auctions")
      .insert({
        name: AUCTION_NAME,
        status: "setup",
        starting_budget: STARTING_BUDGET,
        squad_size: SQUAD_SIZE,
        min_bid: MIN_BID,
        ...(adminProfile ? { created_by: adminProfile.id } : {}),
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
    .select("id, display_name, role")
    .eq("auction_id", auction.id)
    .eq("role", "admin")
    .maybeSingle();

  if (existingAdmin) {
    console.log(`⚡  Admin already exists: ${existingAdmin.display_name}`);
  } else {
    const adminName = adminProfile?.display_name ?? "Admin";
    const { error: adminErr } = await supabase.from("live_auction_participants").insert({
      auction_id: auction.id,
      display_name: adminName,
      role: "admin",
      ...(adminProfile ? { user_id: adminProfile.id } : {}),
    });
    if (adminErr) {
      console.error("❌  Failed to insert admin participant:", adminErr.message);
      process.exit(1);
    }
    console.log(`✅  Added admin participant: ${adminName}`);
  }

  // ─── 4. Add Conrad, DD, Nimai as participants ─────────────────────────────
  const { data: existingParticipants } = await supabase
    .from("live_auction_participants")
    .select("display_name")
    .eq("auction_id", auction.id);

  const existingNames = new Set((existingParticipants ?? []).map((p) => p.display_name));

  for (const name of PARTICIPANTS) {
    if (existingNames.has(name)) {
      console.log(`⚡  Participant already exists: ${name}`);
      continue;
    }
    const { error: pErr } = await supabase.from("live_auction_participants").insert({
      auction_id: auction.id,
      display_name: name,
      role: "participant",
    });
    if (pErr) {
      console.error(`❌  Failed to add participant ${name}:`, pErr.message);
    } else {
      console.log(`✅  Added participant: ${name}`);
    }
  }

  // ─── 5. Seed World Cup 2026 players ──────────────────────────────────────
  // Check what WC teams are available in the players table
  const { data: teamRows, error: teamErr } = await supabase
    .from("players")
    .select("team_name")
    .not("team_name", "is", null);

  if (teamErr) {
    console.error("❌  Failed to fetch team names:", teamErr.message);
    process.exit(1);
  }

  // Get distinct team names
  const allTeams = [...new Set((teamRows ?? []).map((r) => r.team_name).filter(Boolean))].sort();
  console.log(`\n📋  Teams available in players table (${allTeams.length} total):`);
  allTeams.forEach((t) => console.log(`  • ${t}`));

  // Fetch all players for seeding
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
    console.warn("⚠️   No players found in the players table. You may need to import them first.");
    console.log(`\n🏁  Auction created. ID: ${auction.id}`);
    console.log(`🔗  Admin link: https://hfwauction.vercel.app/live-auction/${auction.id}/admin`);
    console.log(`🔗  Overview:   https://hfwauction.vercel.app/live-auction/${auction.id}\n`);
    return;
  }

  console.log(`\n🌍  Seeding ${allPlayers.length} players into live_auction_players...`);

  // Check how many are already seeded
  const { count: alreadySeeded } = await supabase
    .from("live_auction_players")
    .select("id", { count: "exact", head: true })
    .eq("auction_id", auction.id);

  if (alreadySeeded && alreadySeeded > 0) {
    console.log(`⚡  ${alreadySeeded} players already seeded — running upsert to sync.`);
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
    process.stdout.write(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)}: ${upserted?.length ?? 0} rows\n`,
    );
  }

  console.log(`\n✅  ${totalUpserted} player(s) seeded.`);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log(`🏆  Auction: "${AUCTION_NAME}"`);
  console.log(`🆔  ID:      ${auction.id}`);
  console.log(`💰  Budget:  £${STARTING_BUDGET} | Squad: ${SQUAD_SIZE} | Min bid: £${MIN_BID}`);
  console.log(`👥  Participants: ${[...(adminProfile ? [adminProfile.display_name + " (admin)"] : ["Admin"]), ...PARTICIPANTS].join(", ")}`);
  console.log("─".repeat(60));
  console.log(`\n🔗  Admin link:  https://hfwauction.vercel.app/live-auction/${auction.id}/admin`);
  console.log(`🔗  Overview:    https://hfwauction.vercel.app/live-auction/${auction.id}\n`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
