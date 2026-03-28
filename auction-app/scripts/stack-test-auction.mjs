/**
 * Stacks a new auction: create_stacked_test_auction RPC.
 *
 * Usage:
 *   node scripts/stack-test-auction.mjs "<auction_name>" "<ISO_or_timestamp>" [userCount] [budget]
 *
 * Example:
 *   node scripts/stack-test-auction.mjs "league_beta" "2026-04-15T19:00:00+01:00" 8 350
 *
 * Requires: scripts/sql/testing-auction-helpers.sql applied in Supabase.
 * npm: npm run stack:auction -- "name" "deadline" 8 350
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

  const [, , name, deadline, userCountStr, budgetStr] = process.argv;
  if (!name || !deadline) {
    console.error(
      'Usage: npm run stack:auction -- "<auction_name>" "<deadline_ISO>" [userCount] [budget]\n' +
        'Example: npm run stack:auction -- "league_beta" "2026-04-15T19:00:00+01:00" 8 350',
    );
    process.exit(1);
  }

  const userCount = Number(userCountStr || 8);
  const budget = Number(budgetStr || 350);
  if (!Number.isFinite(userCount) || userCount < 1) {
    console.error("Invalid user count");
    process.exit(1);
  }
  if (!Number.isFinite(budget) || budget < 1) {
    console.error("Invalid budget");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("create_stacked_test_auction", {
    p_auction_name: name,
    p_hard_deadline: deadline,
    p_user_count: userCount,
    p_start_budget: budget,
    p_is_active: true,
  });

  if (error) {
    console.error("RPC error:", error.message);
    console.error(JSON.stringify(error, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
  console.log("\nPoint a UI or AUCTION_LAB_AUCTION_ID at data.auction_id to work with this auction.");
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
