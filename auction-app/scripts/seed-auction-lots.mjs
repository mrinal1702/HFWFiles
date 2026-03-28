/**
 * Calls seed_auction_lots_for_auction using AUCTION_LAB_AUCTION_ID from .env.local (default 2).
 *
 * Usage: npm run seed:auction-lots
 *
 * Run scripts/sql/seed-auction-lots-all-players.sql once in Supabase to create the RPC.
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

  const raw = process.env.AUCTION_LAB_AUCTION_ID;
  const auctionId = Number(raw?.trim() || 2);
  if (!Number.isFinite(auctionId) || auctionId < 1) {
    console.error("Invalid AUCTION_LAB_AUCTION_ID");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("seed_auction_lots_for_auction", {
    p_auction_id: auctionId,
  });

  if (error) {
    console.error("RPC error:", error.message);
    console.error(JSON.stringify(error, null, 2));
    console.error(
      "\nIf the function is missing, run scripts/sql/seed-auction-lots-all-players.sql in the Supabase SQL Editor (full file).",
    );
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
