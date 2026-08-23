/**
 * Upsert player gameweek scores from one or more *FinalPoints.csv files.
 * Auction-agnostic — writes to public."Player_Scores".
 *
 * Keeper units in FinalPoints use team_id as player_id; this script remaps them
 * to 90_000_000 + team_id to match the players table / auction squads.
 *
 * Usage:
 *   node scripts/upsert-player-scores-from-finalpoints.mjs <game_week_id> [--prune-gw] <csv> [csv...]
 *
 * --prune-gw  Delete GW rows for players not present in the supplied FinalPoints files
 *             (removes stale scores, e.g. old World Cup data on a reused game_week_id).
 *
 * Example (GW1, two completed WC matches):
 *   node scripts/upsert-player-scores-from-finalpoints.mjs 1 ^
 *     "../Matches_Raw/World Cup 2026/Mexico_SouthAfrica_FinalPoints.csv" ^
 *     "../Matches_Raw/World Cup 2026/SouthKorea_Czechia_FinalPoints.csv"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { isKeeperUnitRow, resolveScorePlayerId } from "./lib/keeper-player-id.mjs";
import { mergeMissingIntoPendingPool, PENDING_POOL_PATH } from "./lib/pending-pool-additions.mjs";
import { validateFinalPointsRows } from "./lib/validate-final-points.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

function parseFinalPointsRow(cols) {
  const hasShootout = cols.length >= 8;
  const statsIdx = 4;
  const endowmentIdx = 5;
  const shootoutIdx = hasShootout ? 6 : null;
  const finalIdx = hasShootout ? 7 : 6;

  const rawPlayerId = Number(cols[1].trim());
  const score = Number(cols[finalIdx]);
  if (!Number.isFinite(rawPlayerId) || !Number.isFinite(score)) return null;

  const stats_score = Number(cols[statsIdx]);
  const endowment_score = Number(cols[endowmentIdx]);
  const shootout_score = shootoutIdx !== null ? Number(cols[shootoutIdx]) : 0;

  return {
    rawPlayerId,
    score,
    player_name: cols[0],
    position: cols[3],
    stats_score,
    endowment_score,
    shootout_score,
    team_name: cols[2],
  };
}

function parseFinalPointsFile(filePath) {
  const csvText = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 7) continue;
    const parsed = parseFinalPointsRow(cols);
    if (!parsed) continue;

    const player_id = resolveScorePlayerId({
      player_id: parsed.rawPlayerId,
      player_name: parsed.player_name,
      position: parsed.position,
    });

    rows.push({
      player_id,
      raw_player_id: parsed.rawPlayerId,
      score: parsed.score,
      player_name: parsed.player_name,
      team_name: parsed.team_name,
      position: parsed.position,
      stats_score: parsed.stats_score,
      endowment_score: parsed.endowment_score,
      shootout_score: parsed.shootout_score,
      source_file: path.basename(filePath),
      is_keeper_unit: isKeeperUnitRow({ player_name: parsed.player_name, position: parsed.position }),
    });
  }
  return rows;
}

function toBatches(arr, size) {
  const batches = [];
  for (let i = 0; i < arr.length; i += size) batches.push(arr.slice(i, i + size));
  return batches;
}

async function pruneGameweekScores(supabase, gameWeekId, allowedPlayerIds) {
  const allowed = new Set(allowedPlayerIds);
  const stale = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const res = await supabase
      .from("Player_Scores")
      .select("player_id")
      .eq("game_week_id", gameWeekId)
      .range(from, from + pageSize - 1);
    if (res.error) throw new Error(`Player_Scores read failed: ${res.error.message}`);
    const batch = res.data ?? [];
    for (const row of batch) {
      const playerId = Number(row.player_id);
      if (!allowed.has(playerId)) stale.push(playerId);
    }
    if (batch.length < pageSize) break;
  }

  if (!stale.length) {
    console.log(`Prune GW${gameWeekId}: no stale rows to remove.`);
    return 0;
  }

  let removed = 0;
  for (const batch of toBatches(stale, 300)) {
    const del = await supabase
      .from("Player_Scores")
      .delete()
      .eq("game_week_id", gameWeekId)
      .in("player_id", batch);
    if (del.error) throw new Error(`Player_Scores prune failed: ${del.error.message}`);
    removed += batch.length;
  }

  console.log(`Prune GW${gameWeekId}: removed ${removed} stale row(s) not in supplied FinalPoints.`);
  return removed;
}

async function main() {
  loadEnvLocal();

  const argv = process.argv.slice(2);
  const pruneGw = argv.includes("--prune-gw");
  const positional = argv.filter((arg) => arg !== "--prune-gw");
  const gameWeekId = Number(positional[0]);
  const csvPaths = positional.slice(1).map((p) => path.resolve(process.cwd(), p));

  if (!Number.isFinite(gameWeekId) || gameWeekId <= 0) {
    throw new Error("Usage: node scripts/upsert-player-scores-from-finalpoints.mjs <game_week_id> <csv> [csv...]");
  }
  if (!csvPaths.length) {
    throw new Error("Provide at least one *FinalPoints.csv path.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials in .env.local");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const parsed = [];
  for (const csvPath of csvPaths) {
    if (!fs.existsSync(csvPath)) throw new Error(`File not found: ${csvPath}`);
    parsed.push(...parseFinalPointsFile(csvPath));
  }

  if (!parsed.length) throw new Error("No score rows parsed from CSV input.");

  validateFinalPointsRows(parsed);

  // Last file wins if the same player appears in multiple inputs (amendment rerun).
  const byPlayer = new Map();
  for (const row of parsed) {
    byPlayer.set(row.player_id, row);
  }
  const rows = [...byPlayer.values()];

  if (pruneGw) {
    await pruneGameweekScores(
      supabase,
      gameWeekId,
      rows.map((r) => r.player_id),
    );
  }

  const legacyKeeperTeamIds = [
    ...new Set(
      rows.filter((r) => r.is_keeper_unit).map((r) => r.raw_player_id),
    ),
  ];

  const payload = rows.map((r) => ({
    player_id: r.player_id,
    game_week_id: gameWeekId,
    Score: r.score,
  }));

  const jsonPayload = rows.map((r) => ({ player_id: r.player_id, score: r.score }));
  const rpc = await supabase.rpc("upsert_player_scores", {
    p_game_week_id: gameWeekId,
    p_rows: jsonPayload,
  });

  let upserted = 0;
  if (rpc.error) {
    const msg = String(rpc.error.message || "");
    const useFallback =
      msg.includes("upsert_player_scores") ||
      msg.includes("player_scores_player_gw_unique") ||
      msg.includes("schema cache");

    if (!useFallback) throw new Error(`upsert_player_scores RPC failed: ${msg}`);

    console.warn("RPC unavailable — falling back to batched Supabase upsert.");
    console.warn("Run scripts/sql/player-scores.sql in Supabase SQL Editor for the RPC.");

    for (const batch of toBatches(payload, 500)) {
      const res = await supabase
        .from("Player_Scores")
        .upsert(batch, { onConflict: "player_id,game_week_id" });
      if (res.error) {
        throw new Error(
          `Upsert failed: ${res.error.message}. Run scripts/sql/player-scores.sql first.`,
        );
      }
      upserted += batch.length;
    }
  } else {
    upserted = Number(rpc.data?.upserted ?? rows.length);
  }

  // Remove pre-remap keeper rows (raw team_id used as player_id).
  if (legacyKeeperTeamIds.length) {
    const del = await supabase
      .from("Player_Scores")
      .delete()
      .eq("game_week_id", gameWeekId)
      .in("player_id", legacyKeeperTeamIds);
    if (del.error) {
      console.warn(`Could not remove legacy keeper rows: ${del.error.message}`);
    } else {
      console.log(
        `Removed legacy keeper team_id rows for GW${gameWeekId}: ${legacyKeeperTeamIds.join(", ")}`,
      );
    }
  }

  const playerIds = rows.map((r) => r.player_id);
  const known = new Set();
  for (const batch of toBatches(playerIds, 300)) {
    const res = await supabase.from("players").select("player_id").in("player_id", batch);
    if (res.error) throw new Error(`players lookup failed: ${res.error.message}`);
    for (const p of res.data || []) known.add(Number(p.player_id));
  }
  const missing = rows.filter((r) => !known.has(r.player_id));

  const keepers = rows.filter((r) => r.is_keeper_unit);
  console.log(`Game week id: ${gameWeekId}`);
  console.log(`Upserted ${upserted} rows into Player_Scores from ${csvPaths.length} file(s).`);
  console.log(`Unique players: ${rows.length} (${keepers.length} keeper units remapped)`);
  if (keepers.length) {
    for (const k of keepers) {
      console.log(`  Keeper: ${k.raw_player_id} -> ${k.player_id}  ${k.player_name}  score ${k.score}`);
    }
  }
  if (missing.length) {
    console.log(`Warning: ${missing.length} player_id(s) not in players table:`);
    for (const m of missing.slice(0, 20)) {
      console.log(`  ${m.player_id}  ${m.player_name}  (${m.team_name})  [${m.source_file}]`);
    }
    if (missing.length > 20) console.log(`  ... and ${missing.length - 20} more`);

    const appended = mergeMissingIntoPendingPool(missing);
    if (appended.length) {
      console.log(
        `Logged ${appended.length} new player(s) to pending pool list -> ${PENDING_POOL_PATH}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
