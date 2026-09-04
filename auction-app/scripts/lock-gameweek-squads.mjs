/**
 * Lock the current auction_teams squads into gameweek_squads for one gameweek,
 * across one or more auctions, and point the leaderboards at that gameweek.
 *
 * Mirrors scripts/sql/auction-gwN-lock-all.sql but runs via the service-role
 * client (no Supabase SQL Editor needed). Idempotent:
 *   - Game_Weeks row is upserted
 *   - gameweek_squads inserts ignore existing rows (unique key)
 *   - Is_Active is flipped to the target GW
 *
 * Usage:
 *   node scripts/lock-gameweek-squads.mjs --gw-id 5 --gw-name "FIFA World Cup Round of 16" --auction-ids 5,6,7
 *   node scripts/lock-gameweek-squads.mjs --gw-id 5 --auction-ids 5,6,7 --dry-run
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
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const opts = { gwId: null, gwName: null, auctionIds: [], dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--gw-id" && argv[i + 1]) opts.gwId = Number(argv[++i]);
    else if (arg === "--gw-name" && argv[i + 1]) opts.gwName = argv[++i];
    else if (arg === "--auction-ids" && argv[i + 1]) {
      opts.auctionIds = argv[++i]
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  if (!Number.isFinite(opts.gwId) || opts.gwId < 1) {
    console.error("❌  --gw-id is required");
    process.exit(1);
  }
  if (!opts.auctionIds.length) {
    console.error("❌  --auction-ids is required (e.g. 5,6,7)");
    process.exit(1);
  }
  return opts;
}

function toBatches(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  loadEnvLocal();
  const opts = parseArgs(process.argv);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  const supabase = createClient(url, key);

  console.log(`Locking GW${opts.gwId} for auctions [${opts.auctionIds.join(", ")}]`);

  // 0) Ensure Game_Weeks row exists (upsert name if provided).
  const gwRes = await supabase
    .from("Game_Weeks")
    .select("id, GW_Name, Is_Active")
    .eq("id", opts.gwId)
    .maybeSingle();
  if (gwRes.error) throw new Error(`Game_Weeks read: ${gwRes.error.message}`);

  const gwName = opts.gwName ?? gwRes.data?.GW_Name ?? `Game Week ${opts.gwId}`;
  if (!gwRes.data) {
    console.log(`  Game_Weeks id=${opts.gwId} missing — will create ("${gwName}")`);
  } else {
    console.log(`  Game_Weeks id=${opts.gwId} exists ("${gwRes.data.GW_Name}")`);
  }

  // 1) Read current live squads for the target auctions.
  const teamRows = [];
  for (const auctionId of opts.auctionIds) {
    const res = await supabase
      .from("auction_teams")
      .select("auction_id, auction_user_id, player_id, purchase_price")
      .eq("auction_id", auctionId);
    if (res.error) throw new Error(`auction_teams (auction ${auctionId}): ${res.error.message}`);
    teamRows.push(...(res.data ?? []));
  }

  const perAuction = new Map();
  for (const r of teamRows) {
    perAuction.set(r.auction_id, (perAuction.get(r.auction_id) ?? 0) + 1);
  }
  console.log(`  auction_teams rows to snapshot: ${teamRows.length}`);
  for (const auctionId of opts.auctionIds) {
    console.log(`    auction ${auctionId}: ${perAuction.get(auctionId) ?? 0} rows`);
  }

  const snapshotRows = teamRows.map((r) => ({
    auction_id: r.auction_id,
    game_week_id: opts.gwId,
    auction_user_id: r.auction_user_id,
    player_id: String(r.player_id),
    purchase_price: r.purchase_price,
  }));

  if (opts.dryRun) {
    console.log("\n🏁  Dry run — no writes.");
    return;
  }

  // 0b) Upsert the Game_Weeks row (keep whatever Is_Active is until step 3).
  const gwUpsert = await supabase
    .from("Game_Weeks")
    .upsert(
      { id: opts.gwId, GW_Name: gwName, Is_Active: gwRes.data?.Is_Active ?? false },
      { onConflict: "id" },
    );
  if (gwUpsert.error) throw new Error(`Game_Weeks upsert: ${gwUpsert.error.message}`);

  // 2) Insert snapshot rows, ignoring any that already exist (unique key).
  let inserted = 0;
  for (const batch of toBatches(snapshotRows, 500)) {
    const ins = await supabase
      .from("gameweek_squads")
      .upsert(batch, {
        onConflict: "auction_id,game_week_id,auction_user_id,player_id",
        ignoreDuplicates: true,
      });
    if (ins.error) throw new Error(`gameweek_squads insert: ${ins.error.message}`);
    inserted += batch.length;
  }
  console.log(`  ✅  Upserted ${inserted} gameweek_squads rows (existing rows left untouched)`);

  // 3) Point leaderboards at the target GW (This Gameweek tab).
  const off = await supabase
    .from("Game_Weeks")
    .update({ Is_Active: false })
    .eq("Is_Active", true);
  if (off.error) throw new Error(`Game_Weeks deactivate: ${off.error.message}`);

  const on = await supabase
    .from("Game_Weeks")
    .update({ Is_Active: true })
    .eq("id", opts.gwId);
  if (on.error) throw new Error(`Game_Weeks activate: ${on.error.message}`);
  console.log(`  ✅  Game_Weeks id=${opts.gwId} is now the active gameweek`);

  // Verify
  const verify = await supabase
    .from("gameweek_squads")
    .select("auction_id, auction_user_id, player_id")
    .eq("game_week_id", opts.gwId)
    .in("auction_id", opts.auctionIds);
  if (verify.error) throw new Error(`verify: ${verify.error.message}`);

  const byAuction = new Map();
  const usersByAuction = new Map();
  for (const r of verify.data ?? []) {
    byAuction.set(r.auction_id, (byAuction.get(r.auction_id) ?? 0) + 1);
    if (!usersByAuction.has(r.auction_id)) usersByAuction.set(r.auction_id, new Set());
    usersByAuction.get(r.auction_id).add(r.auction_user_id);
  }

  console.log("\n── Verify: gameweek_squads for GW" + opts.gwId + " ──");
  for (const auctionId of opts.auctionIds) {
    console.log(
      `  auction ${auctionId}: ${byAuction.get(auctionId) ?? 0} rows, ` +
        `${usersByAuction.get(auctionId)?.size ?? 0} managers`,
    );
  }

  const gwList = await supabase
    .from("Game_Weeks")
    .select("id, GW_Name, Is_Active")
    .order("id", { ascending: true });
  if (!gwList.error) {
    console.log("\n── Game_Weeks ──");
    for (const g of gwList.data ?? []) {
      console.log(`  ${g.id}  ${g.Is_Active ? "[ACTIVE]" : "        "}  ${g.GW_Name}`);
    }
  }

  console.log(`\nLive: https://hfwauction.vercel.app/leaderboard/${opts.auctionIds[0]}`);
}

main().catch((err) => {
  console.error("\n❌ ", err.message || err);
  process.exit(1);
});
