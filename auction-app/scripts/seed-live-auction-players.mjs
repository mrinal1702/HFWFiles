/**
 * Seeds live_auction_players from the existing players table.
 *
 * Copies players belonging to the specified teams/nations into the player pool
 * for a given live auction. Safe to run multiple times — uses upsert on
 * (auction_id, fotmob_player_id).
 *
 * Usage:
 *   node scripts/seed-live-auction-players.mjs \
 *     --auction-id <uuid> \
 *     --teams "Brazil,England,Argentina,Germany,France,Spain"
 *
 * Or with npm (add to package.json scripts if desired):
 *   npm run seed:live-auction-players -- --auction-id <uuid> --teams "Brazil,England"
 *
 * Options:
 *   --auction-id   UUID of the live_auctions row (required)
 *   --teams        Comma-separated team_name values from the players table (required)
 *   --dry-run      Print what would be inserted without writing to the database
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

// ─── Env loader (same pattern as other scripts in this project) ───────────────

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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// ─── CLI args parser ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = value;
    }
  }
  return args;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌  Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));

  const auctionId = args["auction-id"];
  const teamsRaw = args["teams"];
  const dryRun = args["dry-run"] === "true";

  if (!auctionId) {
    console.error("❌  --auction-id is required");
    console.error("    Example: node scripts/seed-live-auction-players.mjs --auction-id <uuid> --teams \"Brazil,England\"");
    process.exit(1);
  }
  if (!teamsRaw) {
    console.error("❌  --teams is required (comma-separated team names)");
    console.error("    Example: --teams \"Brazil,England,Argentina\"");
    process.exit(1);
  }

  const teamNames = teamsRaw.split(",").map((t) => t.trim()).filter(Boolean);
  if (teamNames.length === 0) {
    console.error("❌  No team names provided after parsing --teams");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Verify the auction exists
  const { data: auction, error: auctionErr } = await supabase
    .from("live_auctions")
    .select("id, name")
    .eq("id", auctionId)
    .maybeSingle();

  if (auctionErr) {
    console.error("❌  Failed to fetch auction:", auctionErr.message);
    process.exit(1);
  }
  if (!auction) {
    console.error(`❌  No live_auction found with id: ${auctionId}`);
    process.exit(1);
  }

  console.log(`\n📋  Auction: ${auction.name} (${auctionId})`);
  console.log(`🏴  Teams: ${teamNames.join(", ")}\n`);

  // Fetch players from the main players table for the given teams
  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("player_id, player_name, team_name, position")
    .in("team_name", teamNames)
    .order("team_name")
    .order("player_name");

  if (playersErr) {
    console.error("❌  Failed to fetch players:", playersErr.message);
    process.exit(1);
  }

  if (!players || players.length === 0) {
    console.warn("⚠️   No players found for the given team names.");
    console.warn("    Check team_name values in the players table match exactly.");
    process.exit(0);
  }

  console.log(`Found ${players.length} player(s) across ${teamNames.length} team(s).\n`);

  // Group by team for display
  const byTeam = {};
  for (const p of players) {
    byTeam[p.team_name] = (byTeam[p.team_name] ?? []);
    byTeam[p.team_name].push(p);
  }
  for (const [team, teamPlayers] of Object.entries(byTeam)) {
    console.log(`  ${team}: ${teamPlayers.length} player(s)`);
  }
  console.log("");

  if (dryRun) {
    console.log("🔍  Dry run — no data written.");
    process.exit(0);
  }

  // Build upsert rows
  // fotmob_player_id is stored as text; players.player_id is a number — coerce to string.
  const rows = players.map((p) => ({
    auction_id: auctionId,
    fotmob_player_id: String(p.player_id),
    player_name: p.player_name,
    team_name: p.team_name ?? null,
    nation: null,       // Can be enriched later if needed
    position: p.position ?? null,
    status: "available",
  }));

  // Upsert in batches of 100 to stay within request size limits
  const BATCH_SIZE = 100;
  let inserted = 0;
  let updated = 0;

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

    inserted += upserted?.length ?? 0;
    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)}: ${upserted?.length ?? 0} row(s) upserted`,
    );
  }

  console.log(`\n✅  Done. ${inserted} player(s) upserted into live_auction_players.`);
  console.log(`    Players with status 'sold' or 'unsold' are NOT reset by this script.`);
  console.log(`    To view the auction: /live-auction/${auctionId}\n`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
