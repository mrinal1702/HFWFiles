/**
 * Applies live-auction-dashboard-codes.sql (join_code, admin_code, admin_grants).
 * Safe to re-run.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const sqlPath = path.join(__dirname, "sql", "live-auction-dashboard-codes.sql");

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
  const m = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!m) throw new Error("Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL");
  return m[1];
}

async function schemaReady(supabase) {
  const probe = await supabase.from("live_auctions").select("join_code, admin_code, max_participants").limit(1);
  if (probe.error) return false;
  const grants = await supabase.from("live_auction_admin_grants").select("id").limit(1);
  return !grants.error;
}

async function applyViaManagementApi(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return false;
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef()}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    console.warn("Management API:", res.status, (await res.text()).slice(0, 200));
    return false;
  }
  console.log("✓ Schema applied via Supabase Management API");
  return true;
}

async function applyViaPostgres(sql) {
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) return false;
  let postgres;
  try {
    postgres = (await import("postgres")).default;
  } catch {
    return false;
  }
  const ref = projectRef();
  for (const region of ["eu-west-1", "us-east-1", "eu-central-1"]) {
    const client = postgres({
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
      await client.unsafe(sql);
      await client.end({ timeout: 2 });
      console.log(`✓ Schema applied via Postgres pooler (${region})`);
      return true;
    } catch {
      await client.end({ timeout: 1 }).catch(() => {});
    }
  }
  return false;
}

function applyViaCli() {
  const result = spawnSync("npx", ["supabase", "db", "query", "-f", sqlPath, "--linked"], {
    cwd: appRoot,
    encoding: "utf8",
    shell: true,
  });
  if (result.status === 0) {
    console.log("✓ Schema applied via supabase db query --linked");
    return true;
  }
  return false;
}

loadEnvLocal();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

if (await schemaReady(supabase)) {
  console.log("✓ Live auction dashboard schema already applied");
  process.exit(0);
}

const sql = fs.readFileSync(sqlPath, "utf8");
if (await applyViaManagementApi(sql)) process.exit(0);
if (applyViaCli()) process.exit(0);
if (await applyViaPostgres(sql)) process.exit(0);

console.error("\nCould not apply DDL automatically. Run in Supabase SQL Editor:\n", sqlPath, "\n");
process.exit(1);
