/**
 * Pause an online auction (closes bidding in UI and server actions).
 *
 * Usage:
 *   node scripts/close-auction-bidding.mjs 10
 *   node scripts/close-auction-bidding.mjs 10 --open   # re-enable bidding
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

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

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const args = process.argv.slice(2).filter((a) => a !== "--open");
  const auctionId = Number(args[0]);
  if (!Number.isFinite(auctionId) || auctionId <= 0) {
    console.error("Usage: node scripts/close-auction-bidding.mjs <auctionId> [--open]");
    process.exit(1);
  }

  const open = process.argv.includes("--open");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: before } = await supabase
    .from("Auctions")
    .select("id, name, is_active")
    .eq("id", auctionId)
    .maybeSingle();
  if (!before) throw new Error(`Auction ${auctionId} not found`);

  const { error } = await supabase
    .from("Auctions")
    .update({ is_active: open })
    .eq("id", auctionId);
  if (error) throw new Error(error.message);

  console.log(
    `${open ? "Opened" : "Closed"} bidding for auction ${auctionId} (${before.name}): is_active ${before.is_active} → ${open}`,
  );
}

main().catch((err) => {
  console.error("❌", err.message || err);
  process.exit(1);
});
