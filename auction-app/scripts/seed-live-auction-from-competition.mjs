/**
 * Seed live_auction_players from competition_players (competition-scoped pool).
 *
 * Usage:
 *   node scripts/seed-live-auction-from-competition.mjs \
 *     --auction-id <uuid> \
 *     --competition-id 4
 *
 * Options:
 *   --dry-run   Preview counts without writing
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

const PAGE_SIZE = 1000;
const BATCH_SIZE = 100;

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

async function fetchAllCompetitionPlayers(supabase, competitionId) {
  let from = 0;
  const all = [];

  while (true) {
    const { data, error } = await supabase
      .from("competition_players")
      .select("player_id, player_name, team_name, position")
      .eq("competition_id", competitionId)
      .order("player_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

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
  const competitionId = Number(args["competition-id"] ?? "4");
  const dryRun = args["dry-run"] === "true";

  if (!auctionId) {
    console.error("❌  --auction-id is required");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: auction, error: auctionErr } = await supabase
    .from("live_auctions")
    .select("id, name")
    .eq("id", auctionId)
    .maybeSingle();

  if (auctionErr || !auction) {
    console.error("❌  Live auction not found:", auctionErr?.message ?? auctionId);
    process.exit(1);
  }

  console.log(`\n📋  Auction: ${auction.name}`);
  console.log(`🏆  Competition id: ${competitionId}\n`);

  const players = await fetchAllCompetitionPlayers(supabase, competitionId);
  if (players.length === 0) {
    console.error(
      "❌  No rows in competition_players. Run: npm run import:competition-players -- uefa-cl-2026-27",
    );
    process.exit(1);
  }

  const byTeam = {};
  for (const p of players) {
    byTeam[p.team_name] = (byTeam[p.team_name] ?? 0) + 1;
  }
  console.log(`Found ${players.length} player(s) across ${Object.keys(byTeam).length} team(s).\n`);

  if (dryRun) {
    console.log("🔍  Dry run — no data written.");
    process.exit(0);
  }

  const rows = players.map((p) => ({
    auction_id: auctionId,
    fotmob_player_id: String(p.player_id),
    player_name: p.player_name,
    team_name: p.team_name ?? null,
    nation: null,
    position: p.position ?? null,
    status: "available",
  }));

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("live_auction_players")
      .upsert(batch, { onConflict: "auction_id,fotmob_player_id", ignoreDuplicates: false })
      .select("id");

    if (error) {
      console.error(`❌  Upsert error (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, error.message);
      process.exit(1);
    }

    upserted += data?.length ?? 0;
    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)}: ${data?.length ?? 0} row(s)`,
    );
  }

  console.log(`\n✅  Done. ${upserted} player(s) in live_auction_players.\n`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
