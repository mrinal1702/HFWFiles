/**
 * Read-only lookup: resolve auth-user UUIDs for the people we want to set as
 * online-auction admins, and show current admin_user_id for auctions 10–13.
 *
 * Usage: node scripts/lookup-admin-user-ids.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

const NAMES = ["Conrad Pastore", "Mrinal Trivedi", "Vihaan Shah", "Sujay Choksey"];
const AUCTION_IDS = [10, 11, 12, 13];

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌  .env.local not found at", envPath);
    process.exit(1);
  }
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌  Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  console.log("\n=== profiles (display_name match) ===");
  for (const name of NAMES) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", name);
    if (error) {
      console.log(`  ${name}: ERROR ${error.message}`);
      continue;
    }
    if (!data?.length) {
      console.log(`  ${name}: (no profile match)`);
    } else {
      for (const r of data) console.log(`  ${name}: ${r.id}  (display_name="${r.display_name}")`);
    }
  }

  console.log("\n=== auction_users (name match, with seat + auction) ===");
  for (const name of NAMES) {
    const { data, error } = await supabase
      .from("auction_users")
      .select("id, auction_id, name, user_id")
      .ilike("name", name)
      .order("auction_id", { ascending: true });
    if (error) {
      console.log(`  ${name}: ERROR ${error.message}`);
      continue;
    }
    if (!data?.length) {
      console.log(`  ${name}: (no auction_users match)`);
    } else {
      for (const r of data) {
        console.log(
          `  ${name}: user_id=${r.user_id ?? "(null)"}  seat_id=${r.id}  auction_id=${r.auction_id}`,
        );
      }
    }
  }

  console.log("\n=== current Auctions.admin_user_id for 10–13 ===");
  const { data: auctions, error: aErr } = await supabase
    .from("Auctions")
    .select("id, name, admin_user_id")
    .in("id", AUCTION_IDS)
    .order("id", { ascending: true });
  if (aErr) {
    console.log(`  ERROR ${aErr.message}`);
  } else {
    for (const a of auctions ?? []) {
      console.log(`  id=${a.id}  name="${a.name}"  admin_user_id=${a.admin_user_id ?? "(null)"}`);
    }
  }
  console.log("");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
