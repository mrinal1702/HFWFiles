/**
 * Creates "UEFA Champions League 2026/27 Auction 2 Live" and seeds UCL player pool.
 * Does not modify Auction 1 or any other live auction.
 *
 * Usage (from auction-app):
 *   node scripts/setup-ucl-live-auction-2.mjs
 *
 * Re-running is safe — finds existing auction by name and refreshes player seed.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

const AUCTION_NAME = "UEFA Champions League 2026/27 Auction 2 Live";
const COMPETITION_ID = 4;
const STARTING_BUDGET = 350;
const SQUAD_SIZE = 18;
const MIN_BID = 5;
const MAX_PARTICIPANTS = 16;

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌  .env.local not found at", envPath);
    process.exit(1);
  }
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

function generateCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 8);
}

async function ensureSchema(supabase) {
  const probe = await supabase
    .from("live_auctions")
    .select("join_code, admin_code, max_participants")
    .limit(1);
  const grantsProbe = await supabase.from("live_auction_admin_grants").select("id").limit(1);
  if (!probe.error && !grantsProbe.error) return;

  console.log("⚙️  Applying live-auction-dashboard-codes.sql …");
  const applyScript = path.join(__dirname, "apply-live-auction-dashboard-schema.mjs");
  const apply = spawnSync(process.execPath, [applyScript], {
    cwd: appRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (apply.status !== 0) process.exit(apply.status ?? 1);
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌  Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  await ensureSchema(supabase);

  let auction;
  const { data: existing, error: findErr } = await supabase
    .from("live_auctions")
    .select("*")
    .eq("name", AUCTION_NAME)
    .maybeSingle();

  if (findErr) {
    console.error("❌  Lookup failed:", findErr.message);
    process.exit(1);
  }

  if (existing) {
    auction = existing;
    console.log(`⚡  Found existing auction (${auction.id})`);
    if (!auction.join_code || !auction.admin_code) {
      const patch = {
        join_code: auction.join_code ?? generateCode(),
        admin_code: auction.admin_code ?? generateCode(),
      };
      const { data: updated, error: updErr } = await supabase
        .from("live_auctions")
        .update(patch)
        .eq("id", auction.id)
        .select("*")
        .single();
      if (updErr) {
        console.error("❌  Could not backfill codes:", updErr.message);
        process.exit(1);
      }
      auction = updated;
    }
  } else {
    const joinCode = generateCode();
    const adminCode = generateCode();
    const { data: created, error: createErr } = await supabase
      .from("live_auctions")
      .insert({
        name: AUCTION_NAME,
        status: "live",
        starting_budget: STARTING_BUDGET,
        squad_size: SQUAD_SIZE,
        min_bid: MIN_BID,
        join_code: joinCode,
        admin_code: adminCode,
        max_participants: MAX_PARTICIPANTS,
      })
      .select("*")
      .single();

    if (createErr) {
      console.error("❌  Create failed:", createErr.message);
      process.exit(1);
    }
    auction = created;
    console.log(`✅  Created live auction (${auction.id})`);
  }

  console.log("\n🌱  Seeding players from competition_players …\n");
  const seedScript = path.join(__dirname, "seed-live-auction-from-competition.mjs");
  const seed = spawnSync(
    process.execPath,
    [seedScript, "--auction-id", auction.id, "--competition-id", String(COMPETITION_ID)],
    { cwd: appRoot, encoding: "utf8", stdio: "inherit" },
  );
  if (seed.status !== 0) process.exit(seed.status ?? 1);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hfwauction.vercel.app";

  console.log("\n════════════════════════════════════════════════════════════");
  console.log(`  ${AUCTION_NAME}`);
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  Auction ID:       ${auction.id}`);
  console.log(`  Participant code: ${auction.join_code}`);
  console.log(`  Admin code:       ${auction.admin_code}`);
  console.log(`  Max participants: ${auction.max_participants ?? MAX_PARTICIPANTS}`);
  console.log(`  Status:           ${auction.status}`);
  console.log("────────────────────────────────────────────────────────────");
  console.log(`  Dashboard:        ${appUrl}/dashboard`);
  console.log(`  Participant view: ${appUrl}/live-auction/${auction.id}`);
  console.log(`  Admin view:       ${appUrl}/live-auction/${auction.id}/admin`);
  console.log("════════════════════════════════════════════════════════════\n");
  console.log("Share participant code with bidders; admin code with commissioner only.");
  console.log("Both enter codes on /dashboard while logged in.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
