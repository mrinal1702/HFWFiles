import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
for (const l of env.split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const AUCTION = 5;
const PID = "843040"; // Pedro Neto
const CONRAD = 38;
const OLD_REFUND = 5;
const NEW_REFUND = 3; // half of original auction price (5), round-half-up
const DRY = process.argv.includes("--dry");

// 1) Guard: read current refund row
const { data: refund, error: rErr } = await s
  .from("auction_elimination_refunds")
  .select("id, purchase_price, refund_amount")
  .eq("auction_id", AUCTION)
  .eq("player_id", PID)
  .eq("auction_user_id", CONRAD)
  .maybeSingle();
if (rErr) throw rErr;
if (!refund) throw new Error("No elimination refund row found for Conrad/Neto — aborting.");
console.log(`Refund row #${refund.id}: purchase_price=${refund.purchase_price}, refund_amount=${refund.refund_amount}`);

if (refund.refund_amount === NEW_REFUND) {
  console.log("Already corrected (refund_amount=3). Nothing to do.");
  process.exit(0);
}
if (refund.refund_amount !== OLD_REFUND) {
  throw new Error(`Unexpected refund_amount=${refund.refund_amount} (expected ${OLD_REFUND}). Aborting to avoid corruption.`);
}

const delta = OLD_REFUND - NEW_REFUND; // amount to claw back = 2

// 2) Read Conrad's budgets
const { data: user, error: uErr } = await s
  .from("auction_users")
  .select("id, name, budget_remaining, active_budget")
  .eq("id", CONRAD)
  .single();
if (uErr) throw uErr;
console.log(`${user.name}: budget_remaining=${user.budget_remaining} active_budget=${user.active_budget}`);
console.log(`\nWill claw back ${delta}:`);
console.log(`  budget_remaining ${user.budget_remaining} -> ${user.budget_remaining - delta}`);
console.log(`  active_budget    ${user.active_budget} -> ${user.active_budget - delta}`);
console.log(`  refund log       ${OLD_REFUND} -> ${NEW_REFUND}`);

if (DRY) { console.log("\nDry run — no writes."); process.exit(0); }

// 3) Update budgets
const { error: buErr } = await s
  .from("auction_users")
  .update({
    budget_remaining: user.budget_remaining - delta,
    active_budget: user.active_budget - delta,
  })
  .eq("id", CONRAD);
if (buErr) throw buErr;

// 4) Update refund log
const { error: luErr } = await s
  .from("auction_elimination_refunds")
  .update({ refund_amount: NEW_REFUND })
  .eq("id", refund.id);
if (luErr) throw luErr;

// 5) Verify
const { data: v } = await s
  .from("auction_users")
  .select("name, budget_remaining, active_budget")
  .eq("id", CONRAD)
  .single();
const { data: vr } = await s
  .from("auction_elimination_refunds")
  .select("purchase_price, refund_amount")
  .eq("id", refund.id)
  .single();
console.log("\n-- Verify --");
console.log(`  ${v.name}: budget_remaining=${v.budget_remaining} active_budget=${v.active_budget}`);
console.log(`  refund row: purchase_price=${vr.purchase_price} refund_amount=${vr.refund_amount}`);
console.log("\nDone.");
