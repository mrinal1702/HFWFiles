/** Read-only: replicate place_bid's roster/GK/outfield counting for auction 11. No writes. */
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
const COMP = 4;
const isGk = (pos) => /^(gk|goalkeeper)$/i.test((pos ?? "").trim());

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

const pool = await pageAll("competition_players", "player_id,player_name,position", { competition_id: COMP });
const poolPos = new Map(pool.map((p) => [String(p.player_id).trim(), p.position]));
const keeperIds = pool.filter((p) => isGk(p.position)).map((p) => String(p.player_id).trim());

// public.players is what place_bid joins / _player_is_goalkeeper reads
let globalRows = [];
for (let i = 0; i < pool.length; i += 200) {
  const ids = pool.slice(i, i + 200).map((p) => p.player_id);
  const r = await s.from("players").select("player_id,player_name,position").in("player_id", ids);
  if (r.error) throw new Error(r.error.message);
  globalRows = globalRows.concat(r.data);
}
const globalPos = new Map(globalRows.map((p) => [String(p.player_id).trim(), p.position]));

const keepersKnown = keeperIds.filter((id) => globalPos.has(id));
console.log(`UCL pool ${pool.length}; in public.players: ${globalPos.size}`);
console.log(`UCL keeper entries: ${keeperIds.length}; of those in public.players: ${keepersKnown.length}`);
const keepersMissing = keeperIds.filter((id) => !globalPos.has(id));
if (keepersMissing.length) {
  console.log("  keepers MISSING from public.players:");
  for (const id of keepersMissing) console.log(`    ${id} ${poolPos.get(id)} ${pool.find((p) => String(p.player_id).trim() === id)?.player_name}`);
}

const users = await s.from("auction_users").select("id,name").eq("auction_id", AUCTION).order("id");
const lots = await pageAll("auction_lots", "player_id,status,current_high_bidder_id", { auction_id: AUCTION });
const teams = await pageAll("auction_teams", "player_id,auction_user_id", { auction_id: AUCTION });

console.log(
  `\n${"manager".padEnd(17)}${"own".padStart(4)}${"lead".padStart(5)}${"slots".padStart(6)}` +
    `${"gk".padStart(4)}${"out".padStart(5)}   ${"invisible".padStart(9)}  can add outfield?`,
);
for (const u of users.data) {
  const lead = lots.filter((l) => l.status === "bidding" && l.current_high_bidder_id === u.id).map((l) => String(l.player_id).trim());
  const own = teams.filter((t) => t.auction_user_id === u.id).map((t) => String(t.player_id).trim());

  // place_bid: total slots = owned (no join) + leading
  const slots = own.length + lead.length;
  // owned counted only when present in public.players (INNER JOIN)
  const ownKnown = own.filter((id) => globalPos.has(id));
  const gkUsed = ownKnown.filter((id) => isGk(globalPos.get(id))).length + lead.filter((id) => isGk(globalPos.get(id))).length;
  const outUsed = ownKnown.filter((id) => !isGk(globalPos.get(id))).length + lead.filter((id) => !isGk(globalPos.get(id))).length;
  const invisible = own.length - ownKnown.length;

  const blockedOut = outUsed + 1 > 17;
  const blockedSlots = slots + 1 > 18;
  const verdict = blockedSlots ? "NO - roster full (18)" : blockedOut ? "NO - outfield cap" : "yes";
  console.log(
    `${(u.name ?? "?").padEnd(17)}${String(own.length).padStart(4)}${String(lead.length).padStart(5)}${String(slots).padStart(6)}` +
      `${String(gkUsed).padStart(4)}${String(outUsed).padStart(5)}   ${String(invisible).padStart(9)}  ${verdict}`,
  );
}

console.log("\nRules in place_bid: total slots max 18, goalkeepers max 1, outfield max 17.");
console.log("'slots' counts owned players PLUS every lot you are currently winning.");
console.log("'invisible' = owned players missing from public.players, so counted in neither gk nor outfield.");
