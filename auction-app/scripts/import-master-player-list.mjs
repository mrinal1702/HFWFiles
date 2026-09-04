/**
 * Replace public.players with rows from master_player_list.csv (full wipe + insert).
 *
 * Usage:
 *   node scripts/import-master-player-list.mjs
 *   node scripts/import-master-player-list.mjs "C:\\path\\to\\master_player_list.csv"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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
    if (values.length < headers.length) {
      console.warn(`Skipping line ${i + 1}: expected ${headers.length} cols, got ${values.length}`);
      continue;
    }
    const row = {};
    headers.forEach((h, j) => {
      row[h] = (values[j] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function toDbRow(csvRow) {
  const pid = Number(csvRow.player_id);
  const tid = Number(csvRow.team_id);
  if (!Number.isFinite(pid) || !Number.isFinite(tid)) return null;
  return {
    player_id: pid,
    player_name: csvRow.player_name || null,
    team_id: tid,
    team_name: csvRow.team_name || null,
    position: csvRow.position || null,
    href: csvRow.href || null,
    source_files: csvRow.source_files || null,
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

  const defaultCsv = path.resolve(appRoot, "..", "Player_List", "master_player_list.csv");
  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultCsv;
  if (!fs.existsSync(csvPath)) {
    console.error("CSV not found:", csvPath);
    process.exit(1);
  }

  const { headers, rows: rawRows } = parseMasterCsv(fs.readFileSync(csvPath, "utf8"));
  const expected = ["player_id", "player_name", "team_id", "team_name", "position", "href", "source_files"];
  const missing = expected.filter((h) => !headers.includes(h));
  if (missing.length) {
    console.error("CSV missing columns:", missing.join(", "));
    process.exit(1);
  }

  const dbRows = [];
  for (const r of rawRows) {
    const row = toDbRow(r);
    if (row) dbRows.push(row);
  }
  if (!dbRows.length) {
    console.error("No valid rows to import.");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log(`Deleting existing players…`);
  const { error: delErr } = await supabase.from("players").delete().not("player_id", "is", null);
  if (delErr) {
    console.error(delErr);
    process.exit(1);
  }

  const batches = chunk(dbRows, 400);
  let inserted = 0;
  for (let b = 0; b < batches.length; b += 1) {
    const { error: insErr } = await supabase.from("players").insert(batches[b]);
    if (insErr) {
      console.error(`Insert batch ${b + 1}/${batches.length}:`, insErr);
      process.exit(1);
    }
    inserted += batches[b].length;
    console.log(`Inserted ${inserted} / ${dbRows.length}`);
  }

  console.log(`\nDone. ${dbRows.length} players loaded from ${csvPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
