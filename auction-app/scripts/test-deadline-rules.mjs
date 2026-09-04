/**
 * Automated test for three-phase auction deadline rules.
 *
 * Creates a temporary auction, runs bids through each deadline phase by
 * manipulating deadline timestamps, asserts expected pass/fail outcomes,
 * then cleans up.
 *
 * Usage:
 *   node scripts/test-deadline-rules.mjs
 *   npm run test:deadlines
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Requires: auction-deadline-rules.sql already applied in Supabase
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition, got, expected) {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.log(`  ❌  ${label}`);
    if (got !== undefined) console.log(`       got:      ${JSON.stringify(got)}`);
    if (expected !== undefined) console.log(`       expected: ${JSON.stringify(expected)}`);
    failed++;
  }
}

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const db = createClient(url, key);

  async function bid(auctionId, playerId, userId, amount) {
    const { data, error } = await db.rpc("place_bid", {
      p_auction_id: auctionId,
      p_player_id: String(playerId),
      p_auction_user_id: userId,
      p_amount: amount,
    });
    if (error) return { ok: false, error: error.message };
    return data;
  }

  async function setDeadlines(auctionId, deadlines) {
    const { error } = await db.from("Auctions").update(deadlines).eq("id", auctionId);
    if (error) throw new Error(`setDeadlines failed: ${error.message}`);
  }

  async function cleanup(auctionId) {
    // Delete in FK-safe order. Ignore errors for optional scoring tables.
    for (const table of ["auction_leaderboard", "auction_score_breakdown"]) {
      try { await db.from(table).delete().eq("auction_id", auctionId); } catch (_) {}
    }
    await db.from("auction_teams").delete().eq("auction_id", auctionId);
    await db.from("auction_bids").delete().eq("auction_id", auctionId);
    await db.from("auction_lots").delete().eq("auction_id", auctionId);
    await db.from("auction_users").delete().eq("auction_id", auctionId);
    await db.from("Auctions").delete().eq("id", auctionId);
  }

  // ── Setup ───────────────────────────────────────────────────────────────────
  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║     Auction Deadline Rules — Test Suite       ║");
  console.log("╚═══════════════════════════════════════════════╝\n");
  console.log("── Setup ─────────────────────────────────────────");

  const { data: maxRow } = await db
    .from("Auctions")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const auctionId = (maxRow?.id ?? 0) + 1;

  // Create auction with all deadlines far in the future
  const { error: aErr } = await db.from("Auctions").insert({
    id: auctionId,
    name: "[TEST] Deadline Rules",
    is_active: true,
    initiation_deadline_at: FUTURE,
    raise_deadline_at: FUTURE,
    hard_deadline_at: FUTURE,
    join_code: `TEST${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    max_participants: 12,
  });
  if (aErr) {
    console.error("  Failed to create auction:", aErr.message);
    process.exit(1);
  }
  console.log(`  Auction created  id=${auctionId}`);

  // Create 3 test users
  const { data: users, error: uErr } = await db
    .from("auction_users")
    .insert([
      { auction_id: auctionId, name: "Alice", budget_remaining: 350, active_budget: 350 },
      { auction_id: auctionId, name: "Bob",   budget_remaining: 350, active_budget: 350 },
      { auction_id: auctionId, name: "Carol", budget_remaining: 350, active_budget: 350 },
    ])
    .select("id, name");
  if (uErr) {
    console.error("  Failed to create users:", uErr.message);
    await cleanup(auctionId);
    process.exit(1);
  }
  const [alice, bob, carol] = users;
  console.log(`  Users: Alice=${alice.id}, Bob=${bob.id}, Carol=${carol.id}`);

  // Seed lots
  const { error: seedErr } = await db.rpc("seed_auction_lots_for_auction", {
    p_auction_id: auctionId,
  });
  if (seedErr) {
    console.error("  Failed to seed lots:", seedErr.message);
    await cleanup(auctionId);
    process.exit(1);
  }

  // Pick 3 players for testing
  const { data: lots } = await db
    .from("auction_lots")
    .select("player_id")
    .eq("auction_id", auctionId)
    .limit(3);
  if (!lots || lots.length < 3) {
    console.error("  Not enough lots seeded — is the players table populated?");
    await cleanup(auctionId);
    process.exit(1);
  }
  const [pA, pB, pC] = lots.map((l) => l.player_id);
  console.log(`  Players: A=${pA}  B=${pB}  C=${pC} (${lots.length} total lots seeded)`);
  console.log();

  // ── Phase 0: All deadlines in the future ───────────────────────────────────
  console.log("── Phase 0: Open bidding (all deadlines in the future) ───────────");

  let r;

  r = await bid(auctionId, pA, alice.id, 10);
  assert("Alice opens player A at £10", r?.ok === true, r);

  r = await bid(auctionId, pB, bob.id, 8);
  assert("Bob opens player B at £8", r?.ok === true, r);

  r = await bid(auctionId, pA, bob.id, 15);
  assert("Bob outbids Alice on player A → £15", r?.ok === true, r);

  r = await bid(auctionId, pA, alice.id, 20);
  assert("Alice raises player A → £20", r?.ok === true, r);
  console.log();

  // ── Phase 1: After initiation deadline ────────────────────────────────────
  console.log("── Phase 1: Initiation deadline passed ───────────────────────────");
  await setDeadlines(auctionId, { initiation_deadline_at: PAST });

  r = await bid(auctionId, pC, carol.id, 5);
  assert(
    "Carol CANNOT open player C (uninitiated) → initiation_deadline_passed",
    r?.ok === false && r?.error === "initiation_deadline_passed",
    r?.error,
    "initiation_deadline_passed",
  );

  r = await bid(auctionId, pA, bob.id, 25);
  assert("Bob CAN still raise player A (already in play) → £25", r?.ok === true, r);

  r = await bid(auctionId, pB, carol.id, 9);
  assert("Carol CAN still raise player B (already in play) → £9", r?.ok === true, r);
  console.log();

  // ── Phase 2: After raise deadline ─────────────────────────────────────────
  // Player A is now at £25. Player B is at £9.
  console.log("── Phase 2: Raise deadline passed (always +5 required) ───────────");
  await setDeadlines(auctionId, { raise_deadline_at: PAST });

  r = await bid(auctionId, pA, alice.id, 26);
  assert(
    "Alice CANNOT raise player A by +1 (£25→£26) → bid_increment_too_small",
    r?.ok === false && r?.error === "bid_increment_too_small",
    r?.error,
    "bid_increment_too_small",
  );

  r = await bid(auctionId, pA, alice.id, 28);
  assert(
    "Alice CANNOT raise player A by +3 (£25→£28) → bid_increment_too_small",
    r?.ok === false && r?.error === "bid_increment_too_small",
    r?.error,
    "bid_increment_too_small",
  );

  r = await bid(auctionId, pA, alice.id, 30);
  assert("Alice CAN raise player A by +5 (£25→£30) ✓", r?.ok === true, r);

  // Player B is at £9. Even though £9 < £50 (old rule: any +1 allowed), raise mode forces +5
  r = await bid(auctionId, pB, bob.id, 10);
  assert(
    "Bob CANNOT raise player B by +1 (£9→£10) even though under £50 → bid_increment_too_small",
    r?.ok === false && r?.error === "bid_increment_too_small",
    r?.error,
    "bid_increment_too_small",
  );

  r = await bid(auctionId, pB, bob.id, 14);
  assert("Bob CAN raise player B by +5 (£9→£14) ✓", r?.ok === true, r);

  r = await bid(auctionId, pC, carol.id, 5);
  assert(
    "Carol STILL cannot open player C (initiation also in past) → initiation_deadline_passed",
    r?.ok === false && r?.error === "initiation_deadline_passed",
    r?.error,
    "initiation_deadline_passed",
  );
  console.log();

  // ── Phase 3: Hard deadline ────────────────────────────────────────────────
  // Player A: Alice leads at £30. Player B: Bob leads at £14. Player C: never bid on.
  console.log("── Phase 3: Hard deadline passed ─────────────────────────────────");
  await setDeadlines(auctionId, { hard_deadline_at: PAST });

  r = await bid(auctionId, pB, carol.id, 19);
  assert(
    "No bid accepted after hard deadline → auction_deadline_passed",
    r?.ok === false && r?.error === "auction_deadline_passed",
    r?.error,
    "auction_deadline_passed",
  );

  const { data: fin, error: finErr } = await db.rpc("finalize_auction_hard_deadline", {
    p_auction_id: auctionId,
    p_force: false,
  });
  assert(
    `finalize_auction_hard_deadline succeeds (${fin?.lots_sold ?? "?"} sold, ${fin?.lots_unsold ?? "?"} unsold)`,
    !finErr && fin?.ok === true,
    finErr?.message ?? fin,
  );

  // Player A should be in auction_teams owned by Alice at £30
  const { data: tA } = await db
    .from("auction_teams")
    .select("auction_user_id, purchase_price")
    .eq("auction_id", auctionId)
    .eq("player_id", parseInt(pA))
    .maybeSingle();
  assert(
    `Player A sold to Alice at £30`,
    tA?.auction_user_id === alice.id && tA?.purchase_price === 30,
    tA,
    { auction_user_id: alice.id, purchase_price: 30 },
  );

  // Player B should be in auction_teams owned by Bob at £14
  const { data: tB } = await db
    .from("auction_teams")
    .select("auction_user_id, purchase_price")
    .eq("auction_id", auctionId)
    .eq("player_id", parseInt(pB))
    .maybeSingle();
  assert(
    `Player B sold to Bob at £14`,
    tB?.auction_user_id === bob.id && tB?.purchase_price === 14,
    tB,
    { auction_user_id: bob.id, purchase_price: 14 },
  );

  // Player C should be unsold (never bid on)
  const { data: lotC } = await db
    .from("auction_lots")
    .select("status")
    .eq("auction_id", auctionId)
    .eq("player_id", pC)
    .maybeSingle();
  assert(
    `Player C marked unsold (never received a bid)`,
    lotC?.status === "unsold",
    lotC?.status,
    "unsold",
  );
  console.log();

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log("── Cleanup ───────────────────────────────────────────────────────");
  await cleanup(auctionId);
  console.log(`  Deleted test auction ${auctionId} and all related rows\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log("═════════════════════════════════════════════════════════════════");
  console.log(`  ${passed}/${total} tests passed${failed > 0 ? `  (${failed} FAILED)` : "  🎉"}`);
  console.log("═════════════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected error:", err?.message ?? err);
  process.exit(1);
});
