/**
 * Apply participant relegation DDL + RPC guards.
 * Uses same auto-DDL paths as apply-team-name-migration.mjs.
 *
 *   node scripts/apply-participant-relegation-migration.mjs
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

async function columnExists(supabase) {
  const probe = await supabase.from("auction_users").select("is_relegated").limit(1);
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
  const regions = ["eu-west-1", "us-east-1", "eu-central-1"];
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
      console.log(`✓ SQL applied via Postgres pooler (${region})`);
      return true;
    } catch (e) {
      await sqlClient.end({ timeout: 1 }).catch(() => {});
      const msg = String(e?.message ?? e);
      if (msg.includes("password authentication failed")) return false;
    }
  }
  return false;
}

function applyViaCli(sqlPath) {
  const result = spawnSync("npx", ["supabase", "db", "query", "-f", sqlPath, "--linked"], {
    cwd: appRoot,
    encoding: "utf8",
    shell: true,
  });
  return result.status === 0;
}

async function runSqlFile(label, relativePath, supabase, skipIfDone) {
  if (skipIfDone && (await skipIfDone(supabase))) {
    console.log(`✓ ${label} already applied`);
    return;
  }

  const sqlPath = path.join(appRoot, "scripts", "sql", relativePath);
  const sql = fs.readFileSync(sqlPath, "utf8");

  if (await applyViaManagementApi(sql)) {
    console.log(`✓ ${label} via Management API`);
    return;
  }
  if (applyViaCli(sqlPath)) {
    console.log(`✓ ${label} via supabase db query --linked`);
    return;
  }
  if (await applyViaPostgres(sql)) {
    console.log(`✓ ${label} via Postgres pooler`);
    return;
  }

  console.error(
    `\nCould not apply ${label} automatically. Run in Supabase SQL Editor:\n  ${sqlPath}\n`,
  );
  process.exit(1);
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key);

  await runSqlFile("participant-relegation-schema.sql", "participant-relegation-schema.sql", supabase, columnExists);
  await runSqlFile("participant-relegation-rpc.sql", "participant-relegation-rpc.sql", supabase, null);

  console.log("\n✅  Relegation schema + RPC guards applied.");
}

main().catch((err) => {
  console.error("\n❌ ", err.message || err);
  process.exit(1);
});
