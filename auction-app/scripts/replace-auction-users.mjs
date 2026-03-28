/**
 * replace_auction_users_fresh_state — wipes one auction’s bids/lots/teams/scores, replaces managers, re-seeds lots.
 *
 * Uses AUCTION_LAB_AUCTION_ID from .env.local (or pass as first arg).
 *
 * Usage:
 *   npm run replace:auction-users -- [auctionId] [userCount] [budget]
 *
 * Example:
 *   npm run replace:auction-users -- 2 10 350
 *
 * Requires: scripts/sql/testing-auction-helpers.sql in Supabase.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

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

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const fromEnv = Number(process.env.AUCTION_LAB_AUCTION_ID || 0);
  const argId = process.argv[2] ? Number(process.argv[2]) : NaN;
  const auctionId = Number.isFinite(argId) && argId > 0 ? argId : fromEnv;

  const userCount = Number(process.argv[3] || 8);
  const budget = Number(process.argv[4] || 350);

  if (!Number.isFinite(auctionId) || auctionId < 1) {
    console.error("Set AUCTION_LAB_AUCTION_ID or pass auction id: npm run replace:auction-users -- 2 8 350");
    process.exit(1);
  }
  if (!Number.isFinite(userCount) || userCount < 1) {
    console.error("Invalid user count");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("replace_auction_users_fresh_state", {
    p_auction_id: auctionId,
    p_user_count: userCount,
    p_start_budget: budget,
  });

  if (error) {
    console.error("RPC error:", error.message);
    console.error(JSON.stringify(error, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
