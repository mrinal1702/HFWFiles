/**
 * Adds auction_users.team_name and seeds known fantasy names for auctions 5 & 6.
 * Safe to re-run (idempotent column add; seeds only fill null team_name).
 *
 * Applies DDL via (in order):
 *  1. SUPABASE_ACCESS_TOKEN + Management API (supabase db query --linked)
 *  2. SUPABASE_DB_PASSWORD + direct Postgres pooler connection
 *  3. Manual: run scripts/sql/auction-team-names.sql in Supabase SQL Editor
 */
import { spawnSync } from "node:child_process";
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
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function projectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!m) throw new Error("Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL");
  return m[1];
}

/** Old quirky display names → fantasy team_name (auctions 5 & 6 only). */
const SEED_BY_AUCTION_USER_ID = {
  33: "Nico",
  37: "Vada Pav FC",
  38: "EmpanadaMama FC",
  40: "Lucho Portuano FC",
  41: "Iceman",
  44: "Virgil VanDant FC",
  46: "DD",
  47: "Easy Money",
  48: "Abhilfc",
  57: "Virgil VanDant FC",
  60: "DG",
  63: "Raheja",
};

async function columnExists(supabase) {
  const probe = await supabase.from("auction_users").select("team_name").limit(1);
  return !probe.error;
}

async function applyViaManagementApi(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return false;

  const ref = projectRef();
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    console.warn("Management API DDL failed:", res.status, (await res.text()).slice(0, 200));
    return false;
  }
  console.log("✓ Column added via Supabase Management API");
  return true;
}

async function applyViaPostgres(sql) {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) return false;

  let postgres;
  try {
    postgres = (await import("postgres")).default;
  } catch {
    console.warn("Install postgres package to use SUPABASE_DB_PASSWORD: npm install postgres --no-save");
    return false;
  }

  const ref = projectRef();
  const regions = [
    "eu-west-1",
    "us-east-1",

  for (const region of regions) {
    const sqlClient = postgres({
      host: `aws-1-${region}.pooler.supabase.com`,
      port: 6543,
      database: "postgres",
      username: `postgres.${ref}`,
      password,
      ssl: "require",
      connect_timeout: 8,
      max: 1,
    });
    try {
      await sqlClient.unsafe(sql);
      await sqlClient.end({ timeout: 2 });
      console.log(`✓ Column added via Postgres pooler (${region})`);
      return true;
    } catch (e) {
      await sqlClient.end({ timeout: 1 }).catch(() => {});
      const msg = String(e?.message ?? e);
      if (msg.includes("password authentication failed")) {
        console.warn("SUPABASE_DB_PASSWORD rejected by pooler");
        return false;
      }
      if (!msg.includes("ENOTFOUND") && !msg.includes("ETIMEDOUT")) {
        console.warn(`Pooler ${region}:`, msg.slice(0, 120));
      }
    }
  }
  return false;
}

function applyViaCli(sqlPath) {
  const result = spawnSync(
    "npx",
    ["supabase", "db", "query", "-f", sqlPath, "--linked"],
    { cwd: appRoot, encoding: "utf8", shell: true },
  );
  if (result.status === 0) {
    console.log("✓ Column added via supabase db query --linked");
    return true;
  }
  return false;
}

async function ensureColumn(supabase) {
  if (await columnExists(supabase)) {
    console.log("✓ auction_users.team_name column already exists");
    return;
  }

  const sqlPath = path.join(appRoot, "scripts", "sql", "auction-team-names.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  if (await applyViaManagementApi(sql)) return;
  if (applyViaCli(sqlPath)) return;
  if (await applyViaPostgres(sql)) return;

  console.error(
    "\nCould not apply DDL automatically. Run this file in Supabase SQL Editor:\n",
    sqlPath,
    "\nOr set SUPABASE_ACCESS_TOKEN (supabase login) or SUPABASE_DB_PASSWORD in .env.local, then re-run.\n",
  );
  process.exit(1);
}

async function seedTeamNames(supabase) {
  let seeded = 0;
  for (const [idRaw, teamName] of Object.entries(SEED_BY_AUCTION_USER_ID)) {
    const id = Number(idRaw);
    const { data: row, error: fetchErr } = await supabase
      .from("auction_users")
      .select("id, team_name, name")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) {
      console.warn(`  skip id ${id}: row not found`);
      continue;
    }
    if (row.team_name?.trim()) {
      console.log(`  skip id ${id} (${row.name}): already has team_name`);
      continue;
    }
    const { error: updErr } = await supabase
      .from("auction_users")
      .update({ team_name: teamName })
      .eq("id", id);
    if (updErr) throw new Error(`seed ${id}: ${updErr.message}`);
    console.log(`  seeded id ${id} (${row.name}) → ${teamName}`);
    seeded++;
  }
  console.log(`✓ Seeded ${seeded} team names`);
}

loadEnvLocal();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

await ensureColumn(supabase);
await seedTeamNames(supabase);
