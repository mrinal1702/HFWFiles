/**
 * Minimal live auction setup: create auction row + admin participant only.
 *
 * Usage:
 *   node scripts/setup-live-auction-minimal.mjs "HFW WC 2026 Auction 2 Live"
 *
 * Optional env overrides:
 *   ADMIN_USER_ID, ADMIN_NAME, ADMIN_EMAIL
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

const AUCTION_NAME = process.argv[2] || "HFW WC 2026 Auction 2 Live";
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "785ab229-1c9e-4208-b20f-76506968d4be";
const ADMIN_NAME = process.env.ADMIN_NAME || "Mrinal Trivedi";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "trivedi.mrinal.dinesh@gmail.com";
const STARTING_BUDGET = 350;
const SQUAD_SIZE = 18;
const MIN_BID = 5;

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

  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) {
    console.error("❌  Auth lookup failed:", authErr.message);
    process.exit(1);
  }

  const adminUser =
    authUsers.users.find((u) => u.id === ADMIN_USER_ID) ??
    authUsers.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

  if (!adminUser) {
    console.error(`❌  Admin user not found for ${ADMIN_EMAIL} (${ADMIN_USER_ID})`);
    process.exit(1);
  }

  console.log(`🔑  Admin: ${adminUser.email} (${adminUser.id})`);

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
    const { data: created, error: createErr } = await supabase
      .from("live_auctions")
      .insert({
        name: AUCTION_NAME,
        status: "setup",
        starting_budget: STARTING_BUDGET,
        squad_size: SQUAD_SIZE,
        min_bid: MIN_BID,
        created_by: adminUser.id,
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

  const { data: existingAdmin } = await supabase
    .from("live_auction_participants")
    .select("*")
    .eq("auction_id", auction.id)
    .eq("user_id", adminUser.id)
    .maybeSingle();

  if (existingAdmin) {
    if (existingAdmin.role !== "admin" || existingAdmin.display_name !== ADMIN_NAME) {
      const { error: updErr } = await supabase
        .from("live_auction_participants")
        .update({ role: "admin", display_name: ADMIN_NAME })
        .eq("id", existingAdmin.id);
      if (updErr) {
        console.error("❌  Failed to update admin participant:", updErr.message);
        process.exit(1);
      }
      console.log(`✅  Updated admin participant: ${ADMIN_NAME}`);
    } else {
      console.log(`⚡  Admin participant already exists: ${ADMIN_NAME}`);
    }
  } else {
    const { error: adminErr } = await supabase.from("live_auction_participants").insert({
      auction_id: auction.id,
      user_id: adminUser.id,
      display_name: ADMIN_NAME,
      role: "admin",
    });
    if (adminErr) {
      console.error("❌  Failed to insert admin participant:", adminErr.message);
      process.exit(1);
    }
    console.log(`✅  Added admin participant: ${ADMIN_NAME}`);
  }

  console.log("\n" + "─".repeat(60));
  console.log(`🏆  Auction: "${auction.name}"`);
  console.log(`🆔  ID:      ${auction.id}`);
  console.log(`📋  Status:  ${auction.status}`);
  console.log(`💰  Budget:  £${auction.starting_budget} | Squad: ${auction.squad_size} | Min bid: £${auction.min_bid}`);
  console.log("─".repeat(60));
  console.log(`\n🔗  Admin:     https://hfwauction.vercel.app/live-auction/${auction.id}/admin`);
  console.log(`🔗  Overview:  https://hfwauction.vercel.app/live-auction/${auction.id}\n`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
