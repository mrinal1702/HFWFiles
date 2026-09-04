/**
 * Open (or close) the transfer window for an online auction.
 *
 * Usage:
 *   node scripts/open-transfer-window.mjs 9
 *   node scripts/open-transfer-window.mjs 9 --close
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
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

loadEnvLocal();

const auctionId = Number(process.argv[2]);
const close = process.argv.includes("--close");

if (!Number.isFinite(auctionId) || auctionId <= 0) {
  console.error("Usage: node scripts/open-transfer-window.mjs <auction_id> [--close]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(url, key);
const open = !close;

const { data: before, error: readErr } = await db
  .from("Auctions")
  .select("id, name, transfer_window_open, hard_deadline_at")
  .eq("id", auctionId)
  .maybeSingle();

if (readErr) {
  console.error(readErr.message);
  process.exit(1);
}
if (!before) {
  console.error(`Auction ${auctionId} not found.`);
  process.exit(1);
}

const { error: updErr } = await db
  .from("Auctions")
  .update({ transfer_window_open: open })
  .eq("id", auctionId);

if (updErr) {
  console.error(updErr.message);
  process.exit(1);
}

const { data: after } = await db
  .from("Auctions")
  .select("id, name, transfer_window_open, hard_deadline_at")
  .eq("id", auctionId)
  .maybeSingle();

console.log(
  `Transfer window ${open ? "OPENED" : "CLOSED"} for auction ${auctionId} (${after?.name ?? "—"}).`,
);
console.log(JSON.stringify(after, null, 2));

if (open && after?.hard_deadline_at) {
  const past = Date.now() >= Date.parse(after.hard_deadline_at);
  if (past) {
    console.warn(
      "Warning: hard_deadline_at has already passed — the Transfer Room UI may still show closed until deadline is extended.",
    );
  }
}
