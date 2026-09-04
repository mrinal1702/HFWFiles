/**
 * Backend transfer — auction 5
 * Sujay Choksey → Conrad Pastore: Ricardo Rodríguez + 8m
 * Conrad Pastore → Sujay Choksey: Bukayo Saka
 *
 * purchase_price is preserved (original auction price) so paid release /
 * elimination refunds are unchanged.
 *
 * Usage: node scripts/backend-transfer-sujay-conrad.mjs [--dry]
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
const SUJAY = 43;
const CONRAD = 38;
const CASH = 8;
const RODRIGUEZ = "115591";
const SAKA = "961995";
const DRY = process.argv.includes("--dry");

const refund = (p) => Math.floor((p + 1) / 2);

async function getTeam(playerId, ownerId) {
  const { data, error } = await s
    .from("auction_teams")
    .select("auction_user_id, purchase_price")
    .eq("auction_id", AUCTION)
    .eq("player_id", playerId)
    .eq("auction_user_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getUser(id) {
  const { data, error } = await s
    .from("auction_users")
    .select("id, name, budget_remaining, active_budget")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

const [sujay, conrad, rod, saka] = await Promise.all([
  getUser(SUJAY),
  getUser(CONRAD),
  getTeam(RODRIGUEZ, SUJAY),
  getTeam(SAKA, CONRAD),
]);

if (!rod) throw new Error("Ricardo Rodríguez not owned by Sujay");
if (!saka) throw new Error("Bukayo Saka not owned by Conrad");
if (sujay.active_budget < CASH) {
  throw new Error(`Sujay active_budget ${sujay.active_budget} < ${CASH} required`);
}

console.log("Pre-transfer:");
console.log(`  Sujay:  budget_remaining=${sujay.budget_remaining} active_budget=${sujay.active_budget}`);
console.log(`  Conrad: budget_remaining=${conrad.budget_remaining} active_budget=${conrad.active_budget}`);
console.log(`  Ricardo Rodríguez @ ${rod.purchase_price} (release ${refund(rod.purchase_price)}) → Conrad`);
console.log(`  Bukayo Saka @ ${saka.purchase_price} (release ${refund(saka.purchase_price)}) → Sujay`);
console.log(`  Cash: Sujay → Conrad £${CASH}m`);

if (DRY) {
  console.log("\nDry run — no writes.");
  process.exit(0);
}

// 1) Move players (preserve purchase_price)
const { error: rodErr } = await s
  .from("auction_teams")
  .update({ auction_user_id: CONRAD })
  .eq("auction_id", AUCTION)
  .eq("player_id", RODRIGUEZ)
  .eq("auction_user_id", SUJAY);
if (rodErr) throw rodErr;

const { error: sakaErr } = await s
  .from("auction_teams")
  .update({ auction_user_id: SUJAY })
  .eq("auction_id", AUCTION)
  .eq("player_id", SAKA)
  .eq("auction_user_id", CONRAD);
if (sakaErr) throw sakaErr;

// 2) Cash transfer
const { error: sujayErr } = await s
  .from("auction_users")
  .update({
    budget_remaining: sujay.budget_remaining - CASH,
    active_budget: sujay.active_budget - CASH,
  })
  .eq("id", SUJAY);
if (sujayErr) throw sujayErr;

const { error: conradErr } = await s
  .from("auction_users")
  .update({
    budget_remaining: conrad.budget_remaining + CASH,
    active_budget: conrad.active_budget + CASH,
  })
  .eq("id", CONRAD);
if (conradErr) throw conradErr;

// 3) Verify
const [sujayV, conradV, rodV, sakaV] = await Promise.all([
  getUser(SUJAY),
  getUser(CONRAD),
  getTeam(RODRIGUEZ, CONRAD),
  getTeam(SAKA, SUJAY),
]);

console.log("\nPost-transfer:");
console.log(`  Sujay:  budget_remaining=${sujayV.budget_remaining} active_budget=${sujayV.active_budget}`);
console.log(`  Conrad: budget_remaining=${conradV.budget_remaining} active_budget=${conradV.active_budget}`);
console.log(`  Ricardo Rodríguez → ${conradV.name} @ ${rodV.purchase_price} (release ${refund(rodV.purchase_price)})`);
console.log(`  Bukayo Saka → ${sujayV.name} @ ${sakaV.purchase_price} (release ${refund(sakaV.purchase_price)})`);
console.log("\nDone.");
