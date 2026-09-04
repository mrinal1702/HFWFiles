/**
 * Read-only pre-bidding health check for one online auction.
 * Makes no writes. Usage: node scripts/health-check-auction-11.mjs [auctionId=11]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of fs.readFileSync(path.join(appRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
}

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const AUCTION = Number(process.argv[2] || 11);

async function count(table, filters) {
  let q = s.from(table).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { count: c, error } = await q;
  if (error) return `ERROR: ${error.message}`;
  return c ?? 0;
}

const { data: auction, error: aErr } = await s
  .from("Auctions")
  .select("*")
  .eq("id", AUCTION)
  .maybeSingle();
if (aErr) throw new Error(aErr.message);

console.log("=== AUCTION ROW ===");
for (const k of Object.keys(auction).sort()) console.log(`  ${k}: ${JSON.stringify(auction[k])}`);

const compId = auction.competition_id;
const { data: comp } = await s.from("competitions").select("*").eq("id", compId).maybeSingle();
console.log("\n=== COMPETITION ===");
console.log(" ", JSON.stringify(comp));

console.log("\n=== MANAGERS ===");
const { data: users } = await s
  .from("auction_users")
  .select("id,name,user_id,budget_remaining,active_budget,paid_release_used,is_relegated")
  .eq("auction_id", AUCTION)
  .order("id");
console.log(`  seats: ${users.length} / max ${auction.max_participants}`);
const oddBudget = users.filter((u) => u.budget_remaining !== 350 || u.active_budget !== 350);
const noAuth = users.filter((u) => !u.user_id);
const relegated = users.filter((u) => u.is_relegated);
const releaseUsed = users.filter((u) => u.paid_release_used);
console.log(`  budgets not 350/350: ${oddBudget.length ? JSON.stringify(oddBudget) : "none"}`);
console.log(`  seats with no login: ${noAuth.length ? JSON.stringify(noAuth.map((u) => u.name)) : "none"}`);
console.log(`  relegated: ${relegated.length}`);
console.log(`  paid_release_used already true: ${releaseUsed.length}`);
const dupNames = Object.entries(
  users.reduce((m, u) => ((m[u.name] = (m[u.name] ?? 0) + 1), m), {}),
).filter(([, n]) => n > 1);
console.log(`  duplicate names: ${dupNames.length ? JSON.stringify(dupNames) : "none"}`);
const dupAuth = Object.entries(
  users.reduce((m, u) => ((m[u.user_id] = (m[u.user_id] ?? 0) + 1), m), {}),
).filter(([, n]) => n > 1);
console.log(`  duplicate logins: ${dupAuth.length ? JSON.stringify(dupAuth) : "none"}`);

console.log("\n=== LOTS ===");
for (const st of ["uninitiated", "bidding", "sold", "unsold"]) {
  console.log(`  ${st}: ${await count("auction_lots", { auction_id: AUCTION, status: st })}`);
}
console.log(`  TOTAL: ${await count("auction_lots", { auction_id: AUCTION })}`);

console.log("\n=== PLAYER POOL (competition_players) ===");
console.log(`  competition ${compId}: ${await count("competition_players", { competition_id: compId })}`);

let pool = [];
for (let from = 0; ; from += 1000) {
  const r = await s
    .from("competition_players")
    .select("player_id,player_name,position,team_name")
    .eq("competition_id", compId)
    .range(from, from + 999);
  if (r.error) throw new Error(r.error.message);
  pool = pool.concat(r.data);
  if (r.data.length < 1000) break;
}
const byClub = pool.reduce((m, p) => ((m[p.team_name ?? "(none)"] = (m[p.team_name ?? "(none)"] ?? 0) + 1), m), {});
const clubs = Object.keys(byClub).sort();
console.log(`  clubs: ${clubs.length}`);
for (const c of clubs) console.log(`    ${c}: ${byClub[c]}`);
const byPos = pool.reduce((m, p) => ((m[p.position ?? "(none)"] = (m[p.position ?? "(none)"] ?? 0) + 1), m), {});
console.log(`  positions: ${JSON.stringify(byPos)}`);
console.log(`  missing name: ${pool.filter((p) => !p.player_name).length}`);
console.log(`  missing position: ${pool.filter((p) => !p.position).length}`);
console.log(`  missing club: ${pool.filter((p) => !p.team_name).length}`);

console.log("\n=== ACTIVITY (should be empty pre-bidding) ===");
console.log(`  bids: ${await count("auction_bids", { auction_id: AUCTION })}`);
console.log(`  owned players (auction_teams): ${await count("auction_teams", { auction_id: AUCTION })}`);
console.log(`  releases: ${await count("auction_releases", { auction_id: AUCTION })}`);
console.log(`  transfers: ${await count("auction_transfers", { auction_id: AUCTION })}`);
console.log(`  gameweek_squads: ${await count("gameweek_squads", { auction_id: AUCTION })}`);
console.log(`  nation deadlines: ${await count("auction_nation_deadlines", { auction_id: AUCTION })}`);

console.log("\n=== DEADLINE ===");
const hard = auction.hard_deadline_at ? new Date(auction.hard_deadline_at) : null;
console.log(`  hard_deadline_at: ${hard ? hard.toISOString() : "NOT SET"}`);
if (hard) {
  const hrs = (hard.getTime() - Date.now()) / 36e5;
  console.log(`  hours from now: ${hrs.toFixed(1)}`);
  console.log(`  Dublin: ${hard.toLocaleString("en-IE", { timeZone: "Europe/Dublin" })}`);
}
console.log(`  initiation_deadline_at: ${auction.initiation_deadline_at ?? "null"}`);
console.log(`  raise_deadline_at: ${auction.raise_deadline_at ?? "null"}`);

console.log("\n=== OTHER AUCTIONS (untouched?) ===");
const { data: others } = await s
  .from("Auctions")
  .select("id,name,is_active,competition_id,hard_deadline_at")
  .order("id");
for (const o of others) {
  console.log(`  ${o.id}: ${o.name} | active=${o.is_active} | comp=${o.competition_id}`);
}
