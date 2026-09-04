/**
 * Import post-live-auction squads into the online auction pipeline.
 *
 * Creates (or resets) an Auctions row, inserts auction_users from the CSV
 * participant column, loads auction_teams with purchase prices, seeds lots,
 * and marks owned players as sold. Budgets are set to placeholder − spent;
 * adjust manually in Supabase before opening bidding.
 *
 * Usage:
 *   node scripts/setup-auction-from-squads-csv.mjs --dry-run
 *   node scripts/setup-auction-from-squads-csv.mjs \
 *     --name "HFW WC 2026 Auction 3" \
 *     --deadline "2026-07-15T20:00:00+01:00"
 *
 * Options:
 *   --csv <path>              Squad CSV (default: ../Auction 3/Auction_3_Teams.csv)
 *   --name <text>             Auction name (default: HFW WC Fantasy Auction 3 Online)
 *   --auction-id <n>          Force Auctions.id (e.g. 7). Fails if id taken by another auction.
 *   --deadline <ISO>          hard_deadline_at (optional; far-future default if omitted)
 *   --placeholder-budget <n>  Starting budget for budget math (default: 350)
 *   --reset                   If this auction already exists (same id or name), wipe and reload
 *   --dry-run                 Validate CSV + player IDs; no writes
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(appRoot, "..");

const DEFAULT_CSV = path.join(workspaceRoot, "Auction 3", "Auction_3_Teams.csv");
const DEFAULT_NAME = "HFW WC Fantasy Auction 3 Online";
const DEFAULT_PLACEHOLDER_BUDGET = 350;

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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const opts = {
    csv: DEFAULT_CSV,
    name: DEFAULT_NAME,
    auctionId: null,
    deadline: null,
    placeholderBudget: DEFAULT_PLACEHOLDER_BUDGET,
    reset: false,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--reset") {
      opts.reset = true;
    } else if (arg === "--csv" && argv[i + 1]) {
      opts.csv = path.resolve(argv[++i]);
    } else if (arg === "--name" && argv[i + 1]) {
      opts.name = argv[++i];
    } else if (arg === "--auction-id" && argv[i + 1]) {
      opts.auctionId = Number(argv[++i]);
    } else if (arg === "--deadline" && argv[i + 1]) {
      opts.deadline = argv[++i];
    } else if (arg === "--placeholder-budget" && argv[i + 1]) {
      opts.placeholderBudget = Number(argv[++i]);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  if (opts.auctionId != null && (!Number.isFinite(opts.auctionId) || opts.auctionId < 1)) {
    console.error("❌  Invalid --auction-id");
    process.exit(1);
  }

  if (!opts.deadline) {
    // Placeholder — set real deadlines before opening bidding (gameweek phase).
    opts.deadline = "2099-12-31T23:59:59+00:00";
  }
  if (!Number.isFinite(opts.placeholderBudget) || opts.placeholderBudget < 1) {
    console.error("❌  Invalid --placeholder-budget");
    process.exit(1);
  }

  return opts;
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

function parseSquadCsv(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV has no data rows");

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const required = ["participant", "player_name", "fotmob_player_id", "price"];
  for (const col of required) {
    if (!headers.includes(col)) {
      throw new Error(`CSV missing required column: ${col}`);
    }
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? "").trim();
    });
    if (!row.participant || !row.fotmob_player_id) continue;
    rows.push(row);
  }

  if (!rows.length) throw new Error("No squad rows parsed from CSV");
  return rows;
}

function summarizeSquads(rows) {
  const byParticipant = new Map();
  for (const row of rows) {
    const name = row.participant;
    if (!byParticipant.has(name)) byParticipant.set(name, []);
    byParticipant.get(name).push(row);
  }
  return byParticipant;
}

async function wipeAuctionState(supabase, auctionId) {
  await supabase
    .from("auction_lots")
    .update({ current_high_bid_id: null, current_high_bidder_id: null })
    .eq("auction_id", auctionId)
    .not("current_high_bid_id", "is", null);

  const tables = [
    "auction_bids",
    "auction_lots",
    "auction_teams",
    "auction_leaderboard",
    "auction_score_breakdown",
    "auction_users",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("auction_id", auctionId);
    if (error) throw new Error(`${table} delete failed: ${error.message}`);
  }
}

async function ensureAuction(supabase, opts) {
  const byName = await supabase
    .from("Auctions")
    .select("id,name,join_code,hard_deadline_at")
    .eq("name", opts.name)
    .maybeSingle();
  if (byName.error) throw new Error(`Auction lookup failed: ${byName.error.message}`);

  let byId = { data: null, error: null };
  if (opts.auctionId != null) {
    byId = await supabase
      .from("Auctions")
      .select("id,name,join_code,hard_deadline_at")
      .eq("id", opts.auctionId)
      .maybeSingle();
    if (byId.error) throw new Error(`Auction id lookup failed: ${byId.error.message}`);
  }

  if (byName.data && byId.data && byName.data.id !== byId.data.id) {
    throw new Error(
      `Name "${opts.name}" is auction id=${byName.data.id}, but --auction-id ${opts.auctionId} is "${byId.data.name}". Resolve conflict manually.`,
    );
  }

  const existing = byId.data ?? byName.data;

  if (existing) {
    if (opts.auctionId != null && existing.id !== opts.auctionId) {
      throw new Error(
        `Auction "${opts.name}" exists as id=${existing.id}, not ${opts.auctionId}. Use --reset only on the target auction.`,
      );
    }
    if (!opts.reset) {
      throw new Error(
        `Auction "${existing.name}" already exists (id=${existing.id}). Re-run with --reset to wipe and reload that auction only.`,
      );
    }
    console.log(`⚡  Resetting auction id=${existing.id} ("${existing.name}") — other auctions untouched`);
    await wipeAuctionState(supabase, existing.id);

    const { data: updated, error: updErr } = await supabase
      .from("Auctions")
      .update({
        name: opts.name,
        is_active: true,
        hard_deadline_at: opts.deadline,
        max_participants: 12,
      })
      .eq("id", existing.id)
      .select("id,name,join_code,hard_deadline_at")
      .single();
    if (updErr) throw new Error(`Auction update failed: ${updErr.message}`);
    return updated;
  }

  if (opts.auctionId != null && byId.data) {
    throw new Error(`Auction id ${opts.auctionId} already exists as "${byId.data.name}". Pick another id.`);
  }

  let newId = opts.auctionId;
  if (newId == null) {
    const nextIdRes = await supabase
      .from("Auctions")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (nextIdRes.error) throw new Error(`Auction id lookup failed: ${nextIdRes.error.message}`);
    newId = Number(nextIdRes.data?.id || 0) + 1;
  } else if (byId.data) {
    throw new Error(`Auction id ${newId} is already taken by "${byId.data.name}".`);
  }

  const joinCode = Math.random().toString(36).slice(2, 10).toUpperCase();
  const { data: created, error: createErr } = await supabase
    .from("Auctions")
    .insert({
      id: newId,
      name: opts.name,
      is_active: true,
      hard_deadline_at: opts.deadline,
      join_code: joinCode,
      max_participants: 12,
    })
    .select("id,name,join_code,hard_deadline_at")
    .single();
  if (createErr) throw new Error(`Auction insert failed: ${createErr.message}`);
  return created;
}

async function validatePlayerIds(supabase, playerIds) {
  const unique = [...new Set(playerIds)];
  const { data, error } = await supabase
    .from("players")
    .select("player_id,player_name")
    .in("player_id", unique);
  if (error) throw new Error(`players lookup failed: ${error.message}`);

  const found = new Set((data ?? []).map((p) => String(p.player_id)));
  const missing = unique.filter((id) => !found.has(id));
  return { missing, foundCount: found.size };
}

function printSummary(byParticipant, placeholderBudget) {
  console.log("\nParticipants and squad spend (from CSV prices):");
  console.log("participant".padEnd(22), "players".padStart(7), "spent".padStart(6), "placeholder_remaining".padStart(22));
  console.log("-".repeat(60));

  for (const [name, rows] of [...byParticipant.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const spent = rows.reduce((sum, r) => sum + Number(r.price || 0), 0);
    const remaining = placeholderBudget - spent;
    console.log(
      name.padEnd(22),
      String(rows.length).padStart(7),
      String(spent).padStart(6),
      String(remaining).padStart(22),
    );
  }
}

function printBudgetSql(auctionId, userRows, placeholderBudget) {
  console.log("\n-- Manual budget overrides (edit values, run in Supabase SQL Editor)");
  console.log(`-- Auction id: ${auctionId}\n`);
  for (const u of userRows) {
    console.log(
      `-- ${u.name}: spent ${u.spent}M → set both columns to your true remaining budget`,
    );
    console.log(
      `update public.auction_users set budget_remaining = <remaining>, active_budget = <remaining> where id = ${u.id}; -- ${u.name}`,
    );
    console.log("");
  }
  console.log(
    `-- Placeholder used: ${placeholderBudget} − spent. Change placeholder with --placeholder-budget if needed.`,
  );
}

async function main() {
  loadEnvLocal();
  const opts = parseArgs(process.argv);

  const rows = parseSquadCsv(opts.csv);
  const byParticipant = summarizeSquads(rows);
  const playerIds = rows.map((r) => String(r.fotmob_player_id));

  console.log(`📄  CSV: ${opts.csv}`);
  console.log(`👥  Participants: ${byParticipant.size}`);
  console.log(`⚽  Squad rows: ${rows.length}`);
  printSummary(byParticipant, opts.placeholderBudget);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(url, key);
  const { missing, foundCount } = await validatePlayerIds(supabase, playerIds);

  if (missing.length) {
    console.error(`\n❌  ${missing.length} player id(s) not in public.players:`);
    for (const id of missing.slice(0, 20)) {
      const row = rows.find((r) => String(r.fotmob_player_id) === id);
      console.error(`   ${id} — ${row?.player_name ?? "?"}`);
    }
    if (missing.length > 20) console.error(`   … and ${missing.length - 20} more`);
    console.error("\nRun: npm run import:players — then retry.");
    process.exit(1);
  }
  console.log(`\n✅  All ${foundCount} player ids found in public.players`);

  if (opts.dryRun) {
    console.log("\n🏁  Dry run complete — no database writes.");
    return;
  }

  const auction = await ensureAuction(supabase, opts);
  console.log(`\n✅  Auction: "${auction.name}" (id=${auction.id}, join_code=${auction.join_code})`);

  const participantNames = [...byParticipant.keys()].sort((a, b) => a.localeCompare(b));
  const usersPayload = participantNames.map((name) => ({
    auction_id: auction.id,
    name,
    budget_remaining: opts.placeholderBudget,
    active_budget: opts.placeholderBudget,
  }));

  const { data: insertedUsers, error: usersErr } = await supabase
    .from("auction_users")
    .insert(usersPayload)
    .select("id,name");
  if (usersErr) throw new Error(`auction_users insert failed: ${usersErr.message}`);

  const userIdByName = new Map((insertedUsers ?? []).map((u) => [u.name, u.id]));

  const teamsPayload = [];
  for (const row of rows) {
    const userId = userIdByName.get(row.participant);
    if (!userId) {
      throw new Error(`No auction_user for participant: ${row.participant}`);
    }
    teamsPayload.push({
      auction_id: auction.id,
      auction_user_id: userId,
      player_id: String(row.fotmob_player_id),
      purchase_price: Number(row.price),
    });
  }

  const { error: teamsErr } = await supabase.from("auction_teams").insert(teamsPayload);
  if (teamsErr) throw new Error(`auction_teams insert failed: ${teamsErr.message}`);
  console.log(`✅  Inserted ${teamsPayload.length} auction_teams rows`);

  const { data: seedResult, error: seedErr } = await supabase.rpc("seed_auction_lots_for_auction", {
    p_auction_id: auction.id,
  });
  if (seedErr) {
    throw new Error(
      `seed_auction_lots_for_auction failed: ${seedErr.message}\nRun scripts/sql/seed-auction-lots-all-players.sql in Supabase first.`,
    );
  }
  console.log(`✅  Seeded lots:`, seedResult);

  const soldPlayerIds = [...new Set(teamsPayload.map((t) => t.player_id))];
  const { error: soldErr } = await supabase
    .from("auction_lots")
    .update({
      status: "sold",
      expires_at: null,
      current_high_bid_id: null,
      current_high_bidder_id: null,
    })
    .eq("auction_id", auction.id)
    .in("player_id", soldPlayerIds);
  if (soldErr) throw new Error(`Mark sold lots failed: ${soldErr.message}`);
  console.log(`✅  Marked ${soldPlayerIds.length} lots as sold`);

  const userBudgetRows = [];
  for (const u of insertedUsers ?? []) {
    const squadRows = byParticipant.get(u.name) ?? [];
    const spent = squadRows.reduce((sum, r) => sum + Number(r.price || 0), 0);
    const remaining = opts.placeholderBudget - spent;

    const { error: budgetErr } = await supabase
      .from("auction_users")
      .update({ budget_remaining: remaining, active_budget: remaining })
      .eq("id", u.id);
    if (budgetErr) throw new Error(`Budget update for ${u.name} failed: ${budgetErr.message}`);

    userBudgetRows.push({ id: u.id, name: u.name, spent, remaining });
  }

  console.log("\n✅  Placeholder budgets applied (budget_remaining = active_budget = placeholder − spent)");
  printBudgetSql(auction.id, userBudgetRows, opts.placeholderBudget);

  console.log("\nNext steps:");
  console.log(`  1. Verify squads: /auctions/${auction.id}/team (after linking auth — see runbook)`);
  console.log("  2. Set true budgets in Supabase (SQL printed above)");
  console.log("  3. Link auth user_id on each auction_users row — do NOT use join code (creates duplicate rows)");
  console.log("  4. Later: set gameweek deadlines before opening bidding");
}

main().catch((err) => {
  console.error("\n❌ ", err.message || err);
  process.exit(1);
});
