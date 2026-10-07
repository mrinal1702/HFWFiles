/**
 * One-off (Oct 2026): restore World Cup 2026 per-player scores ("Player_Scores",
 * game_week_id 1–8) after EPL MW1–3 had overwritten GW1–3 and GW4–8 had been cleared.
 *
 * Source: the FinalPoints CSVs the app showed during the tournament
 * (auction-app/data/competitions/world-cup-2026/match-scores/, restored from git
 * 5147fec^), mapped to gameweeks by lib/match-scores/competitions/world-cup-2026.ts.
 * These match all 2,625 published Best XI picks. Keeper rows are remapped to
 * 90_000_000 + team_id, same as upsert-player-scores-from-finalpoints.mjs.
 *
 * Refuses to run if GW1–8 already hold scores. Validates against
 * competitions/archive/world-cup-2026/records/best-xi/*.json afterwards.
 *
 * Run from auction-app/:
 *   node ../competitions/archive/world-cup-2026/ops/restore-wc-player-scores.mjs --dry-run
 *   node ../competitions/archive/world-cup-2026/ops/restore-wc-player-scores.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const appRoot = path.resolve(process.cwd());
const require = createRequire(path.join(appRoot, "package.json"));
const { createClient } = require("@supabase/supabase-js");
const { resolveScorePlayerId } = await import(
  pathToFileURL(path.join(appRoot, "scripts/lib/keeper-player-id.mjs")).href
);

for (const l of fs.readFileSync(path.join(appRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim();
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const DRY = process.argv.includes("--dry-run");

const csvDir = path.join(appRoot, "data/competitions/world-cup-2026/match-scores");
const registry = fs.readFileSync(path.join(appRoot, "lib/match-scores/competitions/world-cup-2026.ts"), "utf8");
const gwOf = new Map();
for (const m of registry.matchAll(/groupStageGw:\s*(\d+),[\s\S]*?loadMatchScoreCsv\("([^"]+)"/g)) {
  gwOf.set(m[2], Number(m[1]));
}
if (gwOf.size !== 103) throw new Error(`Expected 103 registered matches, found ${gwOf.size}`);

// Parse CSVs → per-GW { player_id → score }.
const byGw = new Map();
for (const [file, gw] of gwOf) {
  const lines = fs.readFileSync(path.join(csvDir, file), "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",");
  const idx = (c) => header.indexOf(c);
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const rec = Object.fromEntries(header.map((h, i) => [h, cols[i]]));
    const pid = resolveScorePlayerId({ player_id: rec.player_id, player_name: rec.player_name, position: rec.position });
    const score = Number(cols[idx("final_score")]);
    if (!Number.isFinite(pid) || !Number.isFinite(score)) throw new Error(`Bad row in ${file}: ${line}`);
    const m = byGw.get(gw) ?? new Map();
    if (m.has(pid)) throw new Error(`Player ${pid} appears twice in GW${gw} (${file})`);
    m.set(pid, score);
    byGw.set(gw, m);
  }
}
for (const [gw, m] of [...byGw].sort((a, b) => a[0] - b[0])) console.log(`GW${gw}: ${m.size} player scores`);

const { count: existing, error: exErr } = await sb
  .from("Player_Scores")
  .select("*", { count: "exact", head: true })
  .gte("game_week_id", 1)
  .lte("game_week_id", 8);
if (exErr) throw exErr;
if (existing) throw new Error(`Refusing: Player_Scores already has ${existing} rows in GW1–8.`);

if (DRY) {
  console.log("DRY RUN — nothing written.");
  process.exit(0);
}

for (const [gw, m] of [...byGw].sort((a, b) => a[0] - b[0])) {
  const rows = [...m].map(([player_id, score]) => ({ player_id, score }));
  const { data, error } = await sb.rpc("upsert_player_scores", { p_game_week_id: gw, p_rows: rows });
  if (error) throw new Error(`GW${gw}: ${error.message}`);
  console.log(`GW${gw}: upserted ${data?.upserted ?? rows.length}`);
}

// Validate against published Best XI picks.
const recDir = path.resolve(appRoot, "../competitions/archive/world-cup-2026/records/best-xi");
let picks = 0;
const bad = [];
for (const a of [5, 6, 7]) {
  for (let gw = 1; gw <= 8; gw += 1) {
    const d = JSON.parse(fs.readFileSync(path.join(recDir, `best_xi_auction_${a}_gw${gw}.json`), "utf8"));
    const ids = [];
    const want = new Map();
    for (const mgr of d.managers) {
      for (const p of [mgr.goalkeeper, ...mgr.outfield]) {
        if (!p || p.player_id == null) continue;
        ids.push(Number(p.player_id));
        want.set(Number(p.player_id), p.score);
      }
    }
    const { data, error } = await sb
      .from("Player_Scores")
      .select("player_id, Score")
      .eq("game_week_id", gw)
      .in("player_id", [...new Set(ids)]);
    if (error) throw error;
    const got = new Map(data.map((r) => [Number(r.player_id), Number(r.Score)]));
    for (const id of ids) {
      picks += 1;
      if (got.get(id) !== want.get(id)) bad.push({ a, gw, id, want: want.get(id), got: got.get(id) });
    }
  }
}
console.log(`Best XI picks checked: ${picks}, mismatches: ${bad.length}`, bad.slice(0, 5));
