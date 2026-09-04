/**
 * Create (or reset) an online lab auction for admin-UI testing.
 *
 * Participants (linked auth profiles):
 *   - Mrinal Trivedi
 *   - Antonio Lopez Cerrato
 *   - Conrad Pastore  ← also set as Auctions.admin_user_id (participant + admin)
 *
 * Player pool lots: Argentina, France, England, Spain only.
 * Each manager gets 3–4 random owned players (sold lots) + budget 200–300.
 *
 * Prerequisites:
 *   1. Run scripts/sql/auction-admin-column.sql in Supabase SQL Editor (once).
 *   2. .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/setup-admin-lab-auction.mjs
 *   node scripts/setup-admin-lab-auction.mjs --reset
 *   node scripts/setup-admin-lab-auction.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

const AUCTION_NAME = "HFW Admin Lab";
const NATIONS = ["Argentina", "France", "England", "Spain"];
const HARD_DEADLINE = "2099-12-31T23:59:59+00:00";

const PARTICIPANTS = [
  { displayName: "Mrinal Trivedi", userId: "b23b15cc-e103-4248-ba55-d1bd6d0608c3" },
  { displayName: "Antonio Lopez Cerrato", userId: "39369514-48b5-4c19-b38a-8666b98ec97e" },
  { displayName: "Conrad Pastore", userId: "464bcacd-00c4-46b6-91d6-1bbdd8b45514", isAdmin: true },
];

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

function parseArgs(argv) {
  return {
    reset: argv.includes("--reset"),
    dryRun: argv.includes("--dry-run"),
  };
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function randomInt(rng, min, maxInclusive) {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

function randomBudget(rng) {
  // 200–300 inclusive, multiples of 5 look auction-like
  return 200 + randomInt(rng, 0, 20) * 5;
}

function randomPurchasePrice(rng) {
  const steps = [5, 10, 15, 20, 25, 30, 35, 40];
  return steps[Math.floor(rng() * steps.length)];
}

function isGk(position) {
  const p = String(position || "")
    .trim()
    .toLowerCase();
  return p === "gk" || p === "goalkeeper";
}

function joinCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function updateEnvLabAuctionId(auctionId) {
  const envPath = path.join(appRoot, ".env.local");
  let content = fs.readFileSync(envPath, "utf8");
  if (/^AUCTION_LAB_AUCTION_ID=/m.test(content)) {
    content = content.replace(/^AUCTION_LAB_AUCTION_ID=.*$/m, `AUCTION_LAB_AUCTION_ID=${auctionId}`);
  } else {
    content += `\nAUCTION_LAB_AUCTION_ID=${auctionId}\n`;
  }
  fs.writeFileSync(envPath, content, "utf8");
}

async function wipeAuctionState(supabase, auctionId) {
  // Clear FK pointers first (bids referenced by lots).
  const { error: clearLotsErr } = await supabase
    .from("auction_lots")
    .update({ current_high_bid_id: null, current_high_bidder_id: null })
    .eq("auction_id", auctionId);
  if (clearLotsErr) throw new Error(`Clear lot pointers failed: ${clearLotsErr.message}`);

  for (const table of [
    "auction_transfers",
    "auction_elimination_refunds",
    "auction_participant_relegations",
    "auction_releases",
    "auction_score_breakdown",
    "auction_leaderboard",
    "gameweek_squads",
    "auction_bids",
    "auction_teams",
    "auction_lots",
    "auction_nation_deadlines",
    "auction_users",
  ]) {
    const { error } = await supabase.from(table).delete().eq("auction_id", auctionId);
    if (error && !/relation|schema cache|Could not find/i.test(error.message)) {
      // Some tables may not exist in every env — ignore missing-table style errors.
      if (!/does not exist/i.test(error.message)) {
        throw new Error(`Wipe ${table} failed: ${error.message}`);
      }
    }
  }
}

async function ensureAdminColumn(supabase) {
  const { data, error } = await supabase.from("Auctions").select("id, admin_user_id").limit(1);
  if (error) {
    if (/admin_user_id/i.test(error.message) || error.code === "PGRST204") {
      return false;
    }
    throw new Error(`Auctions probe failed: ${error.message}`);
  }
  // If select worked, column exists (even if all null).
  void data;
  return true;
}

async function main() {
  loadEnvLocal();
  const opts = parseArgs(process.argv);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌  Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const rng = mulberry32(20260722);

  const hasAdminCol = await ensureAdminColumn(supabase);
  if (!hasAdminCol) {
    console.warn("⚠️   Auctions.admin_user_id is missing — auction will be created without it.");
    console.warn("    After this script finishes, run the SQL printed at the end in Supabase.");
  }

  // Resolve next / existing auction id
  const { data: existingByName, error: findErr } = await supabase
    .from("Auctions")
    .select("id, name")
    .eq("name", AUCTION_NAME)
    .maybeSingle();
  if (findErr) throw new Error(`Auction lookup failed: ${findErr.message}`);

  let auctionId;
  if (existingByName) {
    auctionId = existingByName.id;
    if (!opts.reset && !opts.dryRun) {
      console.error(
        `❌  "${AUCTION_NAME}" already exists as id=${auctionId}. Re-run with --reset to wipe and rebuild.`,
      );
      process.exit(1);
    }
  } else {
    const { data: maxRow, error: maxErr } = await supabase
      .from("Auctions")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) throw new Error(`Max auction id failed: ${maxErr.message}`);
    auctionId = Number(maxRow?.id || 0) + 1;
  }

  // Players for the four nations
  const { data: nationPlayers, error: playersErr } = await supabase
    .from("players")
    .select("player_id, player_name, team_name, position")
    .in("team_name", NATIONS);
  if (playersErr) throw new Error(`Players fetch failed: ${playersErr.message}`);
  if (!nationPlayers?.length) throw new Error("No players found for Argentina/France/England/Spain");

  // Prefer real named players over composite keeper rows when assigning squads
  const assignable = nationPlayers.filter((p) => !/keepers$/i.test(String(p.player_name || "").trim()));
  const pool = assignable.length >= 12 ? assignable : nationPlayers;

  const adminUserId = PARTICIPANTS.find((p) => p.isAdmin)?.userId;
  if (!adminUserId) throw new Error("No admin participant configured");

  // Draft random squads (3–4 each, ≤1 GK, no overlap)
  const deck = [...pool];
  shuffleInPlace(deck, rng);
  const assignments = new Map(); // userId -> players[]
  let cursor = 0;
  for (const part of PARTICIPANTS) {
    const n = randomInt(rng, 3, 4);
    const picked = [];
    let gkCount = 0;
    while (picked.length < n && cursor < deck.length) {
      const candidate = deck[cursor++];
      if (isGk(candidate.position) && gkCount >= 1) continue;
      if (isGk(candidate.position)) gkCount += 1;
      picked.push({
        ...candidate,
        purchase_price: randomPurchasePrice(rng),
      });
    }
    if (picked.length < 3) {
      throw new Error(`Could not assign enough players to ${part.displayName}`);
    }
    assignments.set(part.userId, picked);
  }

  const budgets = new Map();
  for (const part of PARTICIPANTS) {
    budgets.set(part.userId, randomBudget(rng));
  }

  console.log("\n📋  Plan");
  console.log(`  Auction: ${AUCTION_NAME} (id=${auctionId})`);
  console.log(`  Nations: ${NATIONS.join(", ")} (${nationPlayers.length} lots)`);
  console.log(`  Admin:   Conrad Pastore (${adminUserId})`);
  for (const part of PARTICIPANTS) {
    const budget = budgets.get(part.userId);
    const squad = assignments.get(part.userId) || [];
    console.log(`\n  ${part.displayName}${part.isAdmin ? " [admin]" : ""}`);
    console.log(`    budget_remaining = active_budget = ${budget}`);
    for (const p of squad) {
      console.log(
        `    • ${p.player_name} (${p.team_name}, ${p.position}) @ ${p.purchase_price}`,
      );
    }
  }

  if (opts.dryRun) {
    console.log("\n✅  Dry run only — no writes.\n");
    return;
  }

  const auctionPayload = {
    name: AUCTION_NAME,
    is_active: true,
    hard_deadline_at: HARD_DEADLINE,
    join_code: joinCode(),
    max_participants: 12,
    transfer_window_open: false,
    transfers_require_admin_approval: false,
    ...(hasAdminCol ? { admin_user_id: adminUserId } : {}),
  };

  if (existingByName && opts.reset) {
    console.log(`\n⚡  Resetting auction id=${auctionId}…`);
    await wipeAuctionState(supabase, auctionId);
    const { error: updErr } = await supabase
      .from("Auctions")
      .update(auctionPayload)
      .eq("id", auctionId);
    if (updErr) throw new Error(`Auction update failed: ${updErr.message}`);
  } else {
    const { error: insErr } = await supabase.from("Auctions").insert({
      id: auctionId,
      ...auctionPayload,
    });
    if (insErr) throw new Error(`Auction insert failed: ${insErr.message}`);
    console.log(`\n✅  Created auction id=${auctionId}`);
  }

  // Insert participants
  const userIdByAuth = new Map();
  for (const part of PARTICIPANTS) {
    const budget = budgets.get(part.userId);
    const { data: row, error } = await supabase
      .from("auction_users")
      .insert({
        auction_id: auctionId,
        name: part.displayName,
        user_id: part.userId,
        budget_remaining: budget,
        active_budget: budget,
      })
      .select("id, name, user_id, budget_remaining, active_budget")
      .single();
    if (error) throw new Error(`Insert auction_user ${part.displayName} failed: ${error.message}`);
    userIdByAuth.set(part.userId, row);
    console.log(`✅  Seat ${row.id}: ${row.name} (budget ${row.budget_remaining})`);
  }

  // Lots for all nation players
  const lotRows = nationPlayers.map((p) => ({
    auction_id: auctionId,
    player_id: String(p.player_id),
    status: "uninitiated",
    expires_at: null,
    current_high_bid_id: null,
    current_high_bidder_id: null,
  }));
  {
    const BATCH = 100;
    for (let i = 0; i < lotRows.length; i += BATCH) {
      const batch = lotRows.slice(i, i + BATCH);
      const { error } = await supabase.from("auction_lots").insert(batch);
      if (error) throw new Error(`Insert lots failed: ${error.message}`);
    }
    console.log(`✅  Seeded ${lotRows.length} lots (${NATIONS.join("/")})`);
  }

  // Assign owned players → auction_teams + mark lots sold
  const teamRows = [];
  const soldPlayerIds = [];
  for (const part of PARTICIPANTS) {
    const seat = userIdByAuth.get(part.userId);
    for (const p of assignments.get(part.userId) || []) {
      const pid = String(p.player_id);
      teamRows.push({
        auction_id: auctionId,
        auction_user_id: seat.id,
        player_id: Number(pid),
        purchase_price: p.purchase_price,
      });
      soldPlayerIds.push(pid);
    }
  }

  const { error: teamErr } = await supabase.from("auction_teams").insert(teamRows);
  if (teamErr) throw new Error(`Insert auction_teams failed: ${teamErr.message}`);

  for (const pid of soldPlayerIds) {
    const { error } = await supabase
      .from("auction_lots")
      .update({
        status: "sold",
        expires_at: null,
        current_high_bid_id: null,
        current_high_bidder_id: null,
      })
      .eq("auction_id", auctionId)
      .eq("player_id", pid);
    if (error) throw new Error(`Mark sold ${pid} failed: ${error.message}`);
  }
  console.log(`✅  Assigned ${teamRows.length} owned players (lots marked sold)`);

  updateEnvLabAuctionId(auctionId);

  const selectCols = hasAdminCol
    ? "id, name, join_code, admin_user_id"
    : "id, name, join_code";
  const { data: auctionRow } = await supabase
    .from("Auctions")
    .select(selectCols)
    .eq("id", auctionId)
    .single();

  console.log("\n" + "─".repeat(60));
  console.log(`🏆  ${auctionRow?.name} (id=${auctionRow?.id})`);
  console.log(`🔑  join_code: ${auctionRow?.join_code}`);
  if (hasAdminCol) {
    console.log(`👮  admin_user_id: ${auctionRow?.admin_user_id}`);
  }
  console.log(`🧪  AUCTION_LAB_AUCTION_ID updated to ${auctionId} in .env.local`);
  console.log(`🔗  Participant: /auctions/${auctionId}/bidding-room`);
  console.log(`🔗  Lab page:    /auction-lab`);
  console.log("─".repeat(60));

  if (!hasAdminCol) {
    console.log(`
⚠️  ONE MORE STEP — paste this into Supabase → SQL Editor → Run:

${fs.readFileSync(path.join(__dirname, "sql", "auction-admin-column.sql"), "utf8")}

update public."Auctions"
set admin_user_id = '${adminUserId}'  -- Conrad Pastore
where id = ${auctionId};

select id, name, admin_user_id from public."Auctions" where id = ${auctionId};
`);
  }

  console.log("Restart npm run dev if it was already running so env reloads.\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
