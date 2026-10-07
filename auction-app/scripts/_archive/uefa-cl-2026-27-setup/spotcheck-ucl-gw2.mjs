/**
 * READ-ONLY spot check after opening UCL GW2 (auctions 10-13).
 * Shows one manager per auction (budget + paid_release_used) and the auction
 * deadline columns. Makes NO writes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const rawLine of fs.readFileSync(path.join(appRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i > 0) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const s = createClient(url, key);

const fmtIST = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "null";

// One sample manager per auction + their pre-boost budget from the earlier precheck.
const SAMPLES = [
  { auction: 10, userId: 121, name: "Antonio Lopez Cerrato", preBoost: 91 },
  { auction: 11, userId: 138, name: "Sumair Patel", preBoost: 118 },
  { auction: 12, userId: 150, name: "Agastya", preBoost: 85 },
  { auction: 13, userId: 163, name: "Conrad Pastore", preBoost: 226 },
];

for (const sample of SAMPLES) {
  const { data: a } = await s
    .from("Auctions")
    .select("id,name,is_active,bidding_deadline_mode,initiation_deadline_at,raise_deadline_at,hard_deadline_at,transfer_window_open")
    .eq("id", sample.auction)
    .maybeSingle();
  const { data: u } = await s
    .from("auction_users")
    .select("id,name,budget_remaining,active_budget,paid_release_used")
    .eq("id", sample.userId)
    .maybeSingle();

  console.log(`\n=================== AUCTION ${sample.auction} — ${a.name} ===================`);
  console.log(`  is_active=${a.is_active}  mode=${a.bidding_deadline_mode}  transfer_window_open=${a.transfer_window_open}`);
  console.log(`  initiation: ${fmtIST(a.initiation_deadline_at)} IST`);
  console.log(`  raise:      ${fmtIST(a.raise_deadline_at)} IST`);
  console.log(`  hard:       ${fmtIST(a.hard_deadline_at)} IST`);
  const expected = sample.preBoost + 100;
  const ok = u.budget_remaining === expected && u.active_budget === expected;
  console.log(`  manager ${u.id} ${u.name}:`);
  console.log(`     pre-boost=${sample.preBoost}  ->  budget_remaining=${u.budget_remaining} active_budget=${u.active_budget}  (expected ${expected}) ${ok ? "✅ +100 OK" : "⚠️ MISMATCH"}`);
  console.log(`     paid_release_used=${u.paid_release_used}  ${u.paid_release_used === false ? "✅ reset (1 release available)" : "⚠️ NOT reset"}`);
}

console.log("\n✅ Read-only spot check complete. No writes performed.");
