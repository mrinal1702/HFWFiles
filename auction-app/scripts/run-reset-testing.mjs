/**
 * Calls public.reset_testing_environment() via Supabase RPC.
 * Writes AUCTION_LAB_AUCTION_ID into .env.local on success.
 *
 * Usage: npm run reset:testing
 *
 * If you see "DELETE requires a WHERE clause", re-run the latest
 * scripts/sql/reset-testing-environment.sql in Supabase (CREATE OR REPLACE function).
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

function writeAuctionLabId(auctionId) {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.warn("No .env.local found; create it and add AUCTION_LAB_AUCTION_ID=" + auctionId);
    return;
  }
  let text = fs.readFileSync(envPath, "utf8");
  const line = `AUCTION_LAB_AUCTION_ID=${auctionId}`;
  if (/^AUCTION_LAB_AUCTION_ID=/m.test(text)) {
    text = text.replace(/^AUCTION_LAB_AUCTION_ID=.*$/m, line);
  } else {
    if (!text.endsWith("\n")) text += "\n";
    text += `${line}\n`;
  }
  fs.writeFileSync(envPath, text, "utf8");
  console.log("\nUpdated .env.local → " + line);
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("reset_testing_environment");

  if (error) {
    console.error("RPC error:", error.message);
    console.error(JSON.stringify(error, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));

  const auctionId = data?.auction_id;
  if (auctionId != null && Number.isFinite(Number(auctionId))) {
    writeAuctionLabId(Number(auctionId));
  }

  console.log("\nRestart npm run dev so Next.js picks up the new AUCTION_LAB_AUCTION_ID.");
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
