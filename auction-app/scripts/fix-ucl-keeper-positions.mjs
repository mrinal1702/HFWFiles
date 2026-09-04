/**
 * Adds the missing UEFA CL 2026/27 goalkeeper rows to public.players so the
 * bidding caps classify them as goalkeepers instead of outfield players.
 *
 * Touches public.players only. No bids, lots, teams, budgets or squads.
 * Rolls back the inserted rows if verification fails.
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
const COMP = 4;
const isGk = (p) => /^(gk|goalkeeper)$/i.test((p ?? "").trim());

async function count(table, eq = {}) {
  let q = s.from(table).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(eq)) q = q.eq(k, v);
  const { count: c, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return c ?? 0;
}

// ── Snapshot the things we must NOT change ──────────────────────────────────
const before = {
  players: await count("players"),
  keepers: await count("players", { position: "Goalkeeper" }),
  bids: await count("auction_bids", { auction_id: 11 }),
  lots: await count("auction_lots", { auction_id: 11 }),
  teams: await count("auction_teams", { auction_id: 11 }),
};
console.log("BEFORE:", JSON.stringify(before));

// ── Work out exactly which keeper rows are missing ──────────────────────────
const { data: poolGks, error: poolErr } = await s
  .from("competition_players")
  .select("player_id,player_name,position,team_id,team_name")
  .eq("competition_id", COMP);
if (poolErr) throw new Error(poolErr.message);

const keepers = poolGks.filter((p) => isGk(p.position));
const existing = new Set();
for (let i = 0; i < keepers.length; i += 200) {
  const r = await s.from("players").select("player_id").in("player_id", keepers.slice(i, i + 200).map((p) => p.player_id));
  if (r.error) throw new Error(r.error.message);
  for (const row of r.data) existing.add(Number(row.player_id));
}
const missing = keepers.filter((p) => !existing.has(Number(p.player_id)));
console.log(`\nUCL keepers: ${keepers.length}, already present: ${existing.size}, to insert: ${missing.length}`);
for (const m of missing) console.log(`  + ${m.player_id}  ${m.player_name}`);

if (missing.length === 0) {
  console.log("\nNothing to do.");
  process.exit(0);
}

// ── Insert ──────────────────────────────────────────────────────────────────
const rows = missing.map((p) => ({
  player_id: p.player_id,
  player_name: p.player_name,
  team_id: p.team_id,
  team_name: p.team_name,
  position: "Goalkeeper",
  source_files: "competition_players:uefa-cl-2026-27",
}));
const ins = await s.from("players").insert(rows);
if (ins.error) throw new Error(`insert failed: ${ins.error.message}`);
console.log(`\ninserted ${rows.length} rows into public.players`);

// ── Verify ──────────────────────────────────────────────────────────────────
const after = {
  players: await count("players"),
  keepers: await count("players", { position: "Goalkeeper" }),
  bids: await count("auction_bids", { auction_id: 11 }),
  lots: await count("auction_lots", { auction_id: 11 }),
  teams: await count("auction_teams", { auction_id: 11 }),
};
console.log("AFTER: ", JSON.stringify(after));

const problems = [];
if (after.players !== before.players + missing.length) problems.push("players row count wrong");
if (after.keepers !== before.keepers + missing.length) problems.push("keeper count wrong");
for (const k of ["bids", "lots", "teams"]) {
  if (after[k] !== before[k]) problems.push(`${k} changed (${before[k]} -> ${after[k]})`);
}

// Live function must now recognise every UCL keeper
let stillWrong = [];
for (const k of keepers) {
  const r = await s.rpc("_player_is_goalkeeper", { p_player_id: String(k.player_id) });
  if (r.error) throw new Error(r.error.message);
  if (r.data !== true) stillWrong.push(`${k.player_id} ${k.player_name}`);
}
if (stillWrong.length) problems.push(`not recognised: ${stillWrong.join(", ")}`);

if (problems.length) {
  console.error("\nVERIFICATION FAILED:", problems.join("; "));
  console.error("rolling back inserted rows...");
  const del = await s.from("players").delete().in("player_id", missing.map((p) => p.player_id));
  console.error(del.error ? `ROLLBACK FAILED: ${del.error.message}` : "rolled back.");
  process.exit(1);
}

console.log(`\nOK — all ${keepers.length} UCL keepers now classified as goalkeepers.`);
console.log("Bids, lots and owned squads untouched.");
