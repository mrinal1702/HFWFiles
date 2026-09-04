/**
 * Import a competition-scoped player pool into Supabase.
 *
 * Writes to public.competition_players (and ensures the competition row exists).
 * Does NOT wipe public.players (EPL pool stays intact).
 *
 * Usage:
 *   node scripts/import-competition-players.mjs uefa-cl-2026-27
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (!q && c === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseMasterCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    if (values.length < headers.length) continue;
    const row = {};
    headers.forEach((h, j) => {
      row[h] = (values[j] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function findCompetitionDir(slug) {
  for (const status of ["active", "archive"]) {
    const dir = path.join(repoRoot, "competitions", status, slug);
    if (fs.existsSync(path.join(dir, "competition.json"))) return dir;
  }
  return null;
}

function toCompetitionPlayerRow(csvRow, competitionId) {
  const pid = Number(csvRow.player_id);
  const tid = Number(String(csvRow.team_id || "").split(";")[0]);
  const teamName = String(csvRow.team_name || "").split(";")[0];
  if (!Number.isFinite(pid) || !Number.isFinite(tid)) return null;
  return {
    competition_id: competitionId,
    player_id: pid,
    player_name: csvRow.player_name || null,
    position: csvRow.position || null,
    team_id: tid,
    team_name: teamName || null,
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const slug = process.argv[2]?.trim();
  if (!slug) {
    console.error("Usage: node scripts/import-competition-players.mjs <competition-slug>");
    process.exit(1);
  }

  const compDir = findCompetitionDir(slug);
  if (!compDir) {
    console.error(`Competition not found: ${slug}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(compDir, "competition.json"), "utf8"));
  const competitionId = manifest.database_competition_id;
  const displayName = manifest.display_name || slug;
  const csvPath = path.join(compDir, manifest.player_pool || "player-pool/master_player_list.csv");

  if (!Number.isFinite(competitionId)) {
    console.error("competition.json missing database_competition_id");
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error("CSV not found:", csvPath);
    process.exit(1);
  }

  const { headers, rows: rawRows } = parseMasterCsv(fs.readFileSync(csvPath, "utf8"));
  const expected = ["player_id", "player_name", "team_id", "team_name", "position"];
  const missing = expected.filter((h) => !headers.includes(h));
  if (missing.length) {
    console.error("CSV missing columns:", missing.join(", "));
    process.exit(1);
  }

  const dbRows = [];
  for (const r of rawRows) {
    const row = toCompetitionPlayerRow(r, competitionId);
    if (row) dbRows.push(row);
  }
  if (!dbRows.length) {
    console.error("No valid rows to import.");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { error: compUpsertErr } = await supabase.from("competitions").upsert(
    {
      id: competitionId,
      slug,
      name: displayName,
      status: manifest.status || "active",
      archived_at: manifest.archived_at,
    },
    { onConflict: "slug" },
  );
  if (compUpsertErr) {
    console.error("competitions upsert failed:", compUpsertErr.message);
    console.error("Has competition-isolation-migrate-all.sql been applied?");
    process.exit(1);
  }

  console.log(`Importing ${dbRows.length} players for ${displayName} (competition_id=${competitionId})`);
  console.log(`Source: ${csvPath}`);
  console.log("Target: public.competition_players only (public.players unchanged)");

  const batches = chunk(dbRows, 400);
  let upserted = 0;
  for (let b = 0; b < batches.length; b += 1) {
    const { error } = await supabase
      .from("competition_players")
      .upsert(batches[b], { onConflict: "competition_id,player_id" });
    if (error) {
      console.error(`Upsert batch ${b + 1}/${batches.length}:`, error.message);
      process.exit(1);
    }
    upserted += batches[b].length;
    console.log(`Upserted ${upserted} / ${dbRows.length}`);
  }

  const teamCount = new Set(dbRows.map((r) => r.team_id)).size;
  const { count } = await supabase
    .from("competition_players")
    .select("*", { count: "exact", head: true })
    .eq("competition_id", competitionId);

  console.log(`\nDone. ${dbRows.length} players across ${teamCount} teams for ${slug}.`);
  console.log(`competition_players rows for competition_id=${competitionId}: ${count ?? "?"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
