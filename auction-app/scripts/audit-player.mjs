import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
for (const l of env.split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const AUCTION = 5;

const { data: users } = await s
  .from("auction_users")
  .select("id, name, budget_remaining, active_budget, is_relegated, relegated_at")
  .eq("auction_id", AUCTION);

const names = ["zahaan", "conrad", "nicolas", "sujay"];
console.log("Relevant managers (auction 5):");
for (const n of names) {
  for (const u of users.filter((x) => new RegExp(n, "i").test(x.name || ""))) {
    console.log(`  ${u.name} (id=${u.id})  budget_remaining=${u.budget_remaining}  active_budget=${u.active_budget}  is_relegated=${u.is_relegated}  relegated_at=${u.relegated_at ?? "-"}`);
  }
}

// All elimination refunds logged for these managers
const ids = users
  .filter((u) => names.some((n) => new RegExp(n, "i").test(u.name || "")))
  .map((u) => u.id);
const { data: refs } = await s
  .from("auction_elimination_refunds")
  .select("auction_user_id, player_id, team_name, purchase_price, refund_amount, created_at")
  .eq("auction_id", AUCTION)
  .in("auction_user_id", ids);
const uName = (id) => users.find((u) => u.id === id)?.name ?? id;
console.log("\nElimination refunds logged for these managers:");
for (const r of refs ?? []) console.log(`  ${uName(r.auction_user_id)}  player=${r.player_id} ${r.team_name}  price=${r.purchase_price} refund=${r.refund_amount}  at=${r.created_at}`);
if (!refs?.length) console.log("  (none)");
