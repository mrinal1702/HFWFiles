/**
 * Seeds auction_lots for auction 11 (UCL 2026/27) and verifies the pool.
 *
 * Aborts if lots already exist. Rolls back automatically if the seeded lots do
 * not match public.competition_players for competition 4 (guards against the
 * legacy global public.players fallback, which holds the 605 EPL players).
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
const AUCTION = 11;
const COMPETITION = 4;

async function lotCount() {
  const { count, error } = await s
    .from("auction_lots")
    .select("*", { count: "exact", head: true })
    .eq("auction_id", AUCTION);
  if (error) throw new Error(`lot count: ${error.message}`);
  return count ?? 0;
}

async function pageAll(table, cols, eq) {
  let out = [];
  for (let from = 0; ; from += 1000) {
    let q = s.from(table).select(cols).range(from, from + 999);
    for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
    const r = await q;
    if (r.error) throw new Error(`${table}: ${r.error.message}`);
    out = out.concat(r.data);
    if (r.data.length < 1000) break;
  }
  return out;
}

const before = await lotCount();
console.log(`lots before: ${before}`);
if (before !== 0) {
  console.error("ABORT: auction 11 already has lots. Not touching them.");
  process.exit(1);
}

const { data: rpc, error: rpcErr } = await s.rpc("seed_auction_lots_for_auction", {
  p_auction_id: AUCTION,
});
if (rpcErr) throw new Error(`rpc: ${rpcErr.message}`);
console.log("rpc returned:", JSON.stringify(rpc));

const after = await lotCount();
console.log(`lots after: ${after}`);

const pool = await pageAll("competition_players", "player_id", { competition_id: COMPETITION });
const poolIds = new Set(pool.map((p) => String(p.player_id).trim()));
console.log(`competition ${COMPETITION} pool size: ${poolIds.size}`);

const lots = await pageAll("auction_lots", "player_id,status", { auction_id: AUCTION });
const statuses = [...new Set(lots.map((l) => l.status))];
const strays = lots.filter((l) => !poolIds.has(String(l.player_id).trim()));
const missing = [...poolIds].filter((id) => !lots.some((l) => String(l.player_id).trim() === id));

console.log(`lot statuses: ${JSON.stringify(statuses)}`);
console.log(`lots not in UCL pool: ${strays.length}`);
console.log(`UCL players with no lot: ${missing.length}`);

const ok =
  after === poolIds.size &&
  strays.length === 0 &&
  missing.length === 0 &&
  statuses.length === 1 &&
  statuses[0] === "uninitiated";

if (!ok) {
  console.error("\nVERIFICATION FAILED — rolling back seeded lots for auction 11.");
  const { error: delErr } = await s.from("auction_lots").delete().eq("auction_id", AUCTION);
  if (delErr) {
    console.error(`ROLLBACK FAILED: ${delErr.message} — delete manually.`);
    process.exit(2);
  }
  console.error(`rolled back. lots now: ${await lotCount()}`);
  process.exit(1);
}

console.log(`\nOK — ${after} lots seeded, all uninitiated, all from the UCL 2026/27 pool.`);
