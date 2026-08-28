/**
 * Marks past World Cup live auctions as completed (hidden from Active Auctions).
 * Safe to re-run.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

const ARCHIVED_NAMES = [
  "WC 2026 Dummy",
  "HFW WC 2026 Auction 1 Live",
  "HFW WC 2026 Auction 2 Live",
];

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

loadEnvLocal();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await supabase
  .from("live_auctions")
  .update({ status: "completed" })
  .in("name", ARCHIVED_NAMES)
  .select("id, name, status");

if (error) {
  console.error("❌", error.message);
  process.exit(1);
}

console.log(`✅  Marked ${data?.length ?? 0} live auction(s) as completed:`);
for (const row of data ?? []) {
  console.log(`   • ${row.name}`);
}
