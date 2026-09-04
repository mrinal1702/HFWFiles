/**
 * Set Pedri's release basis to the original auction price (85), not the
 * back-end deal price (55). Affects paid release and future elimination refund.
 *
 * Rule: release = half (round-half-up) of original auction price.
 * Nicolas Pastore (id 33), auction 5, player 1083323.
 *
 * Usage: node scripts/correct-pedri-release-basis.mjs [--dry]
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
for (const l of env.split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const AUCTION = 5;
const PLAYER = "1083323";
const OWNER = 33; // Nicolas Pastore
const DEAL_PRICE = 55;
const AUCTION_PRICE = 85;
const EXPECTED_REFUND = Math.floor((AUCTION_PRICE + 1) / 2); // 43
const DRY = process.argv.includes("--dry");

const { data: row, error } = await s
  .from("auction_teams")
  .select("auction_user_id, purchase_price")
  .eq("auction_id", AUCTION)
  .eq("player_id", PLAYER)
  .eq("auction_user_id", OWNER)
  .maybeSingle();
if (error) throw error;
if (!row) throw new Error("Pedri not owned by Nicolas in auction 5 — aborting.");

console.log(`Current purchase_price: ${row.purchase_price}`);
console.log(`Target purchase_price:  ${AUCTION_PRICE} (original auction price; deal was ${DEAL_PRICE})`);
console.log(`Paid release refund:    ${Math.floor((row.purchase_price + 1) / 2)} -> ${EXPECTED_REFUND}`);

if (row.purchase_price === AUCTION_PRICE) {
  console.log("\nAlready corrected. Nothing to do.");
  process.exit(0);
}
if (row.purchase_price !== DEAL_PRICE) {
  throw new Error(`Unexpected purchase_price=${row.purchase_price} (expected ${DEAL_PRICE}). Aborting.`);
}

if (DRY) {
  console.log("\nDry run — no writes.");
  process.exit(0);
}

const { error: upErr } = await s
  .from("auction_teams")
  .update({ purchase_price: AUCTION_PRICE })
  .eq("auction_id", AUCTION)
  .eq("player_id", PLAYER)
  .eq("auction_user_id", OWNER);
if (upErr) throw upErr;

const { data: v } = await s
  .from("auction_teams")
  .select("purchase_price")
  .eq("auction_id", AUCTION)
  .eq("player_id", PLAYER)
  .eq("auction_user_id", OWNER)
  .single();
console.log(`\nVerify: purchase_price=${v.purchase_price}, refund=${Math.floor((v.purchase_price + 1) / 2)}`);
console.log("Done.");
