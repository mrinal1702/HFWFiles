/**
 * Standard gameweek runner. Every step reads competitions/<tier>/<slug>/rounds/<round>/round.json —
 * a new gameweek is new DATA (the round manifest), never a new script.
 *
 * Usage (from auction-app/):
 *   node scripts/gameweek.mjs <step> --competition <slug> --round <mwNN> [--apply]
 *
 * Steps (in order — see docs/GAMEWEEK_RUNBOOK.md):
 *   init-round      create rounds/<round>/round.json from the previous round (writes a local file only)
 *   status          read-only overview: manifest, scored matches, app sheets, DB state per auction
 *   open            open the bidding window from round.bidding (deadlines, budget boost, resets)
 *   lock            snapshot squads into gameweek_squads for this round's legacy gameweek id
 *   upload-scores   upsert every scored match's FinalPoints into Player_Scores
 *   best-xi         compute Best XI per auction (formation-engine) and publish standings + overlays
 *   verify          check-gameweek-surfaces for this round's auctions
 *
 * Writes to Supabase happen ONLY with --apply. Without it every step is a dry run.
 * Match scoring itself is Python: python ../scoring-engine/score_match.py --competition … --round … --url …
 *
 * Auctions are discovered from Supabase (scripts/lib/gameweek-auctions.mjs): every started auction in the
 * competition whose first gameweek is this round or earlier. round.json / competition.json auction_ids are
 * informational only. The +100 first-gameweek boost is automatic (round.json budget_boost is not used).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import {
  auctionsPlayingRound,
  FIRST_GAMEWEEK_BOOST,
  loadCompetitionAuctions,
  openPlanFor,
} from "./lib/gameweek-auctions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");
const STEPS = ["init-round", "status", "open", "lock", "upload-scores", "best-xi", "verify"];

// ── args / env ───────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const [step, ...rest] = argv.slice(2);
  const opts = { step, competition: null, round: null, apply: false, allowPartial: false, allowArchived: false, gwName: null };
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === "--apply") opts.apply = true;
    else if (a === "--allow-partial") opts.allowPartial = true;
    else if (a === "--allow-archived") opts.allowArchived = true;
    else if (a === "--competition" && rest[i + 1]) opts.competition = rest[++i];
    else if (a === "--round" && rest[i + 1]) opts.round = rest[++i];
    else if (a === "--gw-name" && rest[i + 1]) opts.gwName = rest[++i];
    else fail(`Unknown argument: ${a}`);
  }
  if (!STEPS.includes(opts.step)) fail(`First argument must be one of: ${STEPS.join(", ")}`);
  if (!opts.competition || !opts.round) fail("--competition <slug> and --round <mwNN> are required");
  if (!/^mw\d{2}$/.test(opts.round)) fail(`--round must look like mw01, mw02 … (got ${opts.round})`);
  return opts;
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i > 0 && !process.env[line.slice(0, i).trim()]) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, d) => fs.writeFileSync(p, `${JSON.stringify(d, null, 2)}\n`, "utf8");
const roundSlug = (n) => `mw${String(n).padStart(2, "0")}`;

// ── context ──────────────────────────────────────────────────────────────────
function loadContext(opts, { needRound = true } = {}) {
  let compDir = path.join(repoRoot, "competitions", "active", opts.competition);
  if (!fs.existsSync(compDir)) {
    const archived = path.join(repoRoot, "competitions", "archive", opts.competition);
    if (!fs.existsSync(archived)) fail(`Competition not found: ${opts.competition}`);
    if (!opts.allowArchived) fail(`${opts.competition} is archived — read-only (pass --allow-archived only for an approved amendment)`);
    compDir = archived;
  }
  const competition = readJson(path.join(compDir, "competition.json"));
  const roundDir = path.join(compDir, "rounds", opts.round);
  const roundPath = path.join(roundDir, "round.json");
  let round = null;
  if (needRound) {
    if (!fs.existsSync(roundPath)) fail(`Missing ${path.relative(repoRoot, roundPath)} — run: node scripts/gameweek.mjs init-round --competition ${opts.competition} --round ${opts.round}`);
    round = readJson(roundPath);
    if (round.competition_slug !== opts.competition || round.round_slug !== opts.round) {
      fail(`${path.relative(repoRoot, roundPath)} names ${round.competition_slug}/${round.round_slug}`);
    }
  }
  const sheetsPath = path.join(appRoot, "data", "competitions", opts.competition, "sheets.json");
  const sheets = fs.existsSync(sheetsPath) ? readJson(sheetsPath) : null;
  // Informational only — the auctions a step acts on come from Supabase (assertAuctions).
  const listedAuctionIds = round?.auction_ids?.length ? round.auction_ids : competition.auction_ids;
  return { compDir, competition, roundDir, roundPath, round, sheets, listedAuctionIds, auctionIds: [] };
}

function supabase() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in auction-app/.env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Auctions playing this round, discovered from Supabase: started auctions of this competition whose
 * first gameweek is this round or earlier. Sets ctx.auctionIds. Notes any difference from the
 * (informational) auction_ids listed in round.json / competition.json.
 */
async function assertAuctions(sb, ctx) {
  let all;
  try {
    all = await loadCompetitionAuctions(sb, ctx.competition.database_competition_id);
  } catch (e) {
    fail(e.message);
  }
  const playing = auctionsPlayingRound(all, ctx.round.round_number);
  ctx.auctionIds = playing.map((a) => a.id);
  const describe = (a) => `${a.id}${a.start_round_id == null ? "" : ` (from MW${a.start_round_number})`}`;
  console.log(`  auctions playing ${ctx.round.round_slug}: ${playing.map(describe).join(", ") || "none"}`);
  const listed = [...new Set((ctx.listedAuctionIds ?? []).map(Number))].sort((x, y) => x - y);
  if (listed.join(",") !== ctx.auctionIds.join(",")) {
    console.log(`  note: round.json/competition.json list [${listed.join(", ")}] — informational; Supabase is used`);
  }
  if (!playing.length) fail(`no started auctions play ${ctx.round.round_slug}`);
  return playing;
}

/** The recorded schedule for this round (competition_rounds), or null when not recorded. */
async function scheduledRound(sb, ctx) {
  const { data, error } = await sb
    .from("competition_rounds")
    .select("initiation_deadline_at, raise_deadline_at, hard_deadline_at")
    .eq("competition_id", ctx.competition.database_competition_id)
    .eq("round_slug", ctx.round?.round_slug ?? ctx.roundSlug)
    .maybeSingle();
  if (error) fail(`competition_rounds: ${error.message}`);
  return data?.hard_deadline_at ? data : null;
}

async function count(sb, table, filters) {
  let q = sb.from(table).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters)) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
  const { count: c, error } = await q;
  if (error) fail(`${table}: ${error.message}`);
  return c ?? 0;
}

function run(cmd, args, { cwd = appRoot } = {}) {
  console.log(`\n$ ${[cmd, ...args].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
  });
  if (r.status !== 0) fail(`${path.basename(args[0] ?? cmd)} exited with ${r.status}`);
}

function scoredFixtures(ctx) {
  return (ctx.round.fixtures ?? [])
    .filter((f) => f.status === "scored")
    .map((f) => ({ ...f, csv: path.join(ctx.roundDir, "matches", f.match_slug, "final-points.csv") }));
}

// ── steps ────────────────────────────────────────────────────────────────────
async function initRound(opts) {
  const ctx = loadContext(opts, { needRound: false });
  ctx.roundSlug = opts.round;
  const sched = await scheduledRound(supabase(), ctx);
  if (fs.existsSync(ctx.roundPath)) fail(`${path.relative(repoRoot, ctx.roundPath)} already exists`);
  const n = Number(opts.round.slice(2));
  const prevPath = path.join(ctx.compDir, "rounds", roundSlug(n - 1), "round.json");
  const prev = fs.existsSync(prevPath) ? readJson(prevPath) : null;
  const start = ctx.sheets?.legacy_game_week_start ?? ctx.competition.legacy_game_week_id_range?.[0];
  if (start == null) fail("Cannot work out the legacy gameweek id (no sheets.json legacy_game_week_start / competition.json range)");
  const label = ctx.sheets?.group_label_template?.replace("{n}", String(n));
  const round = {
    competition_slug: opts.competition,
    database_competition_id: ctx.competition.database_competition_id,
    database_round_id: null,
    round_slug: opts.round,
    display_name: `Matchweek ${n}`,
    round_number: n,
    legacy_game_week_id: start + n - 1,
    gw_name: opts.gwName ?? label ?? `Matchweek ${n}`,
    expected_match_count: prev?.expected_match_count ?? null,
    bidding: {
      bidding_deadline_mode: "global",
      // Prefilled from the recorded schedule (record-competition-schedule.mjs) when available.
      initiation_deadline_at: sched ? new Date(sched.initiation_deadline_at).toISOString() : "FILL-ME ISO UTC e.g. 2026-10-20T13:15:00.000Z",
      raise_deadline_at: sched ? new Date(sched.raise_deadline_at).toISOString() : "FILL-ME",
      hard_deadline_at: sched ? new Date(sched.hard_deadline_at).toISOString() : "FILL-ME",
      reset_paid_release: true,
      reopen_unsold: true,
      transfer_window_open: true,
      requires_locked_game_week_id: prev ? prev.legacy_game_week_id : null,
    },
    fixtures: [],
    squad_lock_state: "open",
    scoring_state: "not_started",
    publication_state: "unpublished",
    algorithm_version: prev?.algorithm_version ?? "1.0",
  };
  fs.mkdirSync(ctx.roundDir, { recursive: true });
  writeJson(ctx.roundPath, round);
  console.log(`✅ Created ${path.relative(repoRoot, ctx.roundPath)} (legacy GW ${round.legacy_game_week_id}, "${round.gw_name}").`);
  console.log(
    sched
      ? "   Bidding deadlines copied from the recorded schedule. Next: node scripts/gameweek.mjs open … (dry run) → --apply"
      : "   No recorded schedule for this round — fill in bidding deadlines (or record schedule.json first), then: open … (dry run) → --apply",
  );
}

async function status(opts) {
  const ctx = loadContext(opts);
  const sb = supabase();
  const auctions = await assertAuctions(sb, ctx);
  const gw = ctx.round.legacy_game_week_id;
  const fx = ctx.round.fixtures ?? [];
  const scored = scoredFixtures(ctx);
  const sheetCount = (ctx.sheets?.sheets ?? []).filter((s) => Number(s.gw) === Number(ctx.round.round_number)).length;
  console.log(`\n${ctx.competition.display_name ?? ctx.competition.slug} · ${ctx.round.display_name} (${opts.round}) · legacy GW ${gw} "${ctx.round.gw_name ?? ""}"`);
  console.log(`  bidding:  ${JSON.stringify(ctx.round.bidding ?? "—")}`);
  console.log(`  matches:  ${scored.length} scored / ${fx.length} listed / expected ${ctx.round.expected_match_count ?? "?"} · app sheets for MW${ctx.round.round_number}: ${sheetCount}`);
  console.log(`  Player_Scores rows for GW ${gw}: ${await count(sb, "Player_Scores", { game_week_id: gw })}`);
  for (const a of auctions) {
    const squads = await count(sb, "gameweek_squads", { auction_id: a.id, game_week_id: gw });
    const board = await count(sb, "auction_leaderboard", { auction_id: a.id, game_week_id: gw });
    const managers = await count(sb, "auction_users", { auction_id: a.id });
    const bidding = await count(sb, "auction_lots", { auction_id: a.id, status: "bidding" });
    const overlay = fs.existsSync(path.join(appRoot, "data/best-xi", `auction-${a.id}-gw${gw}.json`));
    console.log(
      `  auction ${a.id}: active=${a.is_active} hard=${a.hard_deadline_at} lots bidding=${bidding} · locked rows=${squads} · standings rows=${board}/${managers} · overlay=${overlay ? "yes" : "no"}`,
    );
  }
}

async function openWindow(opts) {
  const ctx = loadContext(opts);
  const b = ctx.round.bidding;
  if (!b) fail("round.json has no `bidding` block");
  for (const k of ["initiation_deadline_at", "raise_deadline_at", "hard_deadline_at"]) {
    if (!b[k] || Number.isNaN(Date.parse(b[k]))) fail(`round.json bidding.${k} is not an ISO date: ${b[k]}`);
  }
  if (!(Date.parse(b.initiation_deadline_at) <= Date.parse(b.raise_deadline_at) && Date.parse(b.raise_deadline_at) <= Date.parse(b.hard_deadline_at))) {
    fail("deadlines must be initiation ≤ raise ≤ hard");
  }
  const sb = supabase();
  const auctions = await assertAuctions(sb, ctx);
  if (b.budget_boost != null && Number(b.budget_boost) !== 0) {
    console.log(`  note: round.json budget_boost (${b.budget_boost}) is not used — the +${FIRST_GAMEWEEK_BOOST} first-gameweek boost is automatic`);
  }
  const sched = await scheduledRound(sb, ctx);
  if (sched) {
    const off = ["initiation_deadline_at", "raise_deadline_at", "hard_deadline_at"].filter((k) => Date.parse(sched[k]) !== Date.parse(b[k]));
    if (off.length) fail(`round.json bidding ${off.join(", ")} differ from the recorded schedule (competition_rounds) — fix one of them first`);
  }
  const hardIso = new Date(b.hard_deadline_at).toISOString();
  const othersBefore = JSON.stringify(
    (await sb.from("Auctions").select("id,is_active,hard_deadline_at,initiation_deadline_at,raise_deadline_at,transfer_window_open").not("id", "in", `(${ctx.auctionIds.join(",")})`).order("id")).data,
  );

  console.log(`\nOPEN ${opts.competition} ${opts.round} for auctions ${ctx.auctionIds.join(", ")}${opts.apply ? "" : "  (DRY RUN — add --apply to write)"}`);
  console.log(`  initiation ${b.initiation_deadline_at} · raise ${b.raise_deadline_at} · hard ${b.hard_deadline_at}`);
  console.log(`  first-gameweek boost +${FIRST_GAMEWEEK_BOOST} for auctions whose first gameweek was MW${ctx.round.round_number - 1} · reset paid releases ${!!b.reset_paid_release} · reopen unsold ${!!b.reopen_unsold} · transfers ${!!b.transfer_window_open}`);

  for (const a of auctions) {
    const plan = openPlanFor(a, ctx.round.round_number);
    if (plan.action !== "open") {
      console.log(`  auction ${a.id}: first gameweek is ${opts.round} — its window was opened by Start Bidding — skipped`);
      continue;
    }
    const boost = plan.boost;
    if (a.hard_deadline_at && new Date(a.hard_deadline_at).toISOString() === hardIso) {
      console.log(`  auction ${a.id}: already open for this round (hard deadline matches) — skipped (prevents a second budget boost)`);
      continue;
    }
    const prevGw = b.requires_locked_game_week_id;
    if (prevGw != null && !(await count(sb, "gameweek_squads", { auction_id: a.id, game_week_id: prevGw }))) {
      fail(`auction ${a.id}: previous gameweek ${prevGw} is not locked — lock it before opening ${opts.round}`);
    }
    const inBidding = await count(sb, "auction_lots", { auction_id: a.id, status: "bidding" });
    if (inBidding) fail(`auction ${a.id}: ${inBidding} lot(s) still 'bidding' — finalize the previous hard deadline first`);
    const { data: users, error: uErr } = await sb.from("auction_users").select("id,budget_remaining,active_budget").eq("auction_id", a.id);
    if (uErr) fail(uErr.message);
    const unsold = await count(sb, "auction_lots", { auction_id: a.id, status: "unsold" });
    console.log(`  auction ${a.id}: ${users.length} managers · would boost +${boost} · reopen ${b.reopen_unsold ? unsold : 0} unsold · set deadlines`);
    if (!opts.apply) continue;

    if (b.reset_paid_release) {
      const { error } = await sb.from("auction_users").update({ paid_release_used: false }).eq("auction_id", a.id);
      if (error) fail(`paid_release reset (${a.id}): ${error.message}`);
    }
    if (boost) {
      for (const u of users) {
        const { error } = await sb
          .from("auction_users")
          .update({ budget_remaining: u.budget_remaining + boost, active_budget: u.active_budget + boost })
          .eq("id", u.id)
          .eq("auction_id", a.id);
        if (error) fail(`budget boost user ${u.id} (${a.id}): ${error.message}`);
      }
    }
    if (b.reopen_unsold && unsold) {
      const { error } = await sb
        .from("auction_lots")
        .update({ status: "uninitiated", expires_at: null, current_high_bid_id: null, current_high_bidder_id: null })
        .eq("auction_id", a.id)
        .eq("status", "unsold");
      if (error) fail(`reopen unsold (${a.id}): ${error.message}`);
    }
    const { error } = await sb
      .from("Auctions")
      .update({
        bidding_deadline_mode: b.bidding_deadline_mode ?? "global",
        initiation_deadline_at: b.initiation_deadline_at,
        raise_deadline_at: b.raise_deadline_at,
        hard_deadline_at: b.hard_deadline_at,
        is_active: true,
        transfer_window_open: !!b.transfer_window_open,
      })
      .eq("id", a.id);
    if (error) fail(`auction update (${a.id}): ${error.message}`);
    console.log(`  auction ${a.id}: ✅ opened`);
  }
  if (opts.apply) {
    const othersAfter = JSON.stringify(
      (await sb.from("Auctions").select("id,is_active,hard_deadline_at,initiation_deadline_at,raise_deadline_at,transfer_window_open").not("id", "in", `(${ctx.auctionIds.join(",")})`).order("id")).data,
    );
    if (othersBefore !== othersAfter) fail("an auction outside this round changed unexpectedly — investigate");
    console.log("  ✓ other auctions untouched");
    ctx.round.squad_lock_state = "open";
    writeJson(ctx.roundPath, ctx.round);
  }
}

async function lock(opts) {
  const ctx = loadContext(opts);
  const sb = supabase();
  const auctions = await assertAuctions(sb, ctx);
  const gw = ctx.round.legacy_game_week_id;
  const pending = [];
  for (const a of auctions) {
    const rows = await count(sb, "gameweek_squads", { auction_id: a.id, game_week_id: gw });
    if (rows) {
      console.log(`  auction ${a.id}: already locked (${rows} rows) — skipped`);
      continue;
    }
    if (a.hard_deadline_at && Date.parse(a.hard_deadline_at) > Date.now()) {
      fail(`auction ${a.id}: hard deadline ${a.hard_deadline_at} has not passed — lock after the deadline`);
    }
    const inBidding = await count(sb, "auction_lots", { auction_id: a.id, status: "bidding" });
    if (inBidding) fail(`auction ${a.id}: ${inBidding} lot(s) still 'bidding' — the hard deadline must be finalized first (open the auction page or run finalize)`);
    console.log(`  auction ${a.id}: will lock`);
    pending.push(a.id);
  }
  if (!pending.length) return console.log("Nothing to lock.");
  run("node", [
    "scripts/lock-gameweek-squads.mjs",
    "--gw-id", String(gw),
    "--gw-name", ctx.round.gw_name ?? `${ctx.round.display_name}`,
    "--auction-ids", pending.join(","),
    ...(opts.apply ? [] : ["--dry-run"]),
  ]);
  if (opts.apply) {
    ctx.round.squad_lock_state = "locked";
    writeJson(ctx.roundPath, ctx.round);
  }
}

async function uploadScores(opts) {
  const ctx = loadContext(opts);
  const scored = scoredFixtures(ctx);
  if (!scored.length) fail("no scored matches in round.json — score them first with scoring-engine/score_match.py");
  const missing = scored.filter((f) => !fs.existsSync(f.csv));
  if (missing.length) fail(`missing final-points.csv for: ${missing.map((f) => f.match_slug).join(", ")}`);
  const expected = ctx.round.expected_match_count;
  if (expected && scored.length < expected && !opts.allowPartial) {
    fail(`only ${scored.length}/${expected} matches scored — finish scoring or pass --allow-partial`);
  }
  run("python", [path.join(repoRoot, "scoring-engine", "validate_final_points.py"), ...scored.map((f) => f.csv)]);
  console.log(`\n${scored.length} match file(s) → Player_Scores game_week_id ${ctx.round.legacy_game_week_id}${opts.apply ? "" : "  (DRY RUN — add --apply to upload)"}`);
  if (!opts.apply) return;
  run("node", ["scripts/upsert-player-scores-from-finalpoints.mjs", String(ctx.round.legacy_game_week_id), ...scored.map((f) => f.csv)]);
}

async function bestXi(opts) {
  const ctx = loadContext(opts);
  const sb = supabase();
  const auctions = await assertAuctions(sb, ctx);
  const gw = ctx.round.legacy_game_week_id;
  if (!(await count(sb, "Player_Scores", { game_week_id: gw }))) fail(`no Player_Scores for GW ${gw} — run upload-scores first`);
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), `bestxi-${opts.competition}-${opts.round}-`));
  for (const f of scoredFixtures(ctx)) {
    const inter = path.join(ctx.roundDir, "matches", f.match_slug, "intermediates");
    for (const name of fs.readdirSync(inter)) {
      if (/_Vs_.*\.json$/.test(name) && !name.endsWith(".manifest.json")) fs.copyFileSync(path.join(inter, name), path.join(stage, name));
    }
  }
  console.log(`staged ${fs.readdirSync(stage).length} match JSON(s) for in-match roles`);
  const master = path.join(ctx.compDir, ctx.competition.player_pool ?? "player-pool/master_player_list.csv");
  for (const a of auctions) {
    if (!(await count(sb, "gameweek_squads", { auction_id: a.id, game_week_id: gw }))) fail(`auction ${a.id}: GW ${gw} not locked — run lock first`);
    const outDir = opts.apply ? path.join(ctx.compDir, "auction-outputs", `auction-${a.id}`, "best-xi") : stage;
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `best_xi_auction_${a.id}_gw${gw}.json`);
    run("python", [
      path.join(repoRoot, "formation-engine", "compute_auction_best_xi.py"),
      "--auction-id", String(a.id), "--gw-id", String(gw), "--master", master, "--matches-dir", stage, "--output", out,
    ], { cwd: repoRoot });
    const res = readJson(out);
    const { data: published, error: pErr } = await sb
      .from("auction_leaderboard")
      .select("auction_user_id,total_score")
      .eq("auction_id", a.id)
      .eq("game_week_id", gw);
    if (pErr) fail(`auction_leaderboard: ${pErr.message}`);
    let note = "not published yet";
    if (published.length) {
      const pub = new Map(published.map((r) => [Number(r.auction_user_id), Number(r.total_score)]));
      const same = res.managers.filter((m) => pub.get(Number(m.auction_user_id)) === Number(m.total_points)).length;
      note = `matches published standings for ${same}/${res.managers.length} managers${same === res.managers.length && published.length === res.managers.length ? " ✓" : " ⚠️ re-publishing would change standings"}`;
    }
    console.log(`  auction ${a.id}: ${res.managers.length} managers · top ${Math.max(...res.managers.map((m) => m.total_points))} · ${note}`);
    if (opts.apply) run("node", ["scripts/publish-best-xi-from-json.mjs", "--auction-id", String(a.id), "--gw-id", String(gw), "--json", out]);
  }
  fs.rmSync(stage, { recursive: true, force: true });
  if (opts.apply) {
    ctx.round.publication_state = "published";
    writeJson(ctx.roundPath, ctx.round);
    console.log("\n✅ Published. Commit + push: data/best-xi overlays, match-score CSVs, sheets.json, round.json, auction-outputs → Vercel deploys.");
  } else {
    console.log("\n(DRY RUN — computed only; add --apply to publish standings + overlays)");
  }
}

async function verify(opts) {
  const ctx = loadContext(opts);
  await assertAuctions(supabase(), ctx);
  run("node", ["scripts/check-gameweek-surfaces.mjs", "--auction-ids", ctx.auctionIds.join(",")]);
}

const opts = parseArgs(process.argv);
const handlers = {
  "init-round": initRound,
  status,
  open: openWindow,
  lock,
  "upload-scores": uploadScores,
  "best-xi": bestXi,
  verify,
};
Promise.resolve(handlers[opts.step](opts)).catch((err) => fail(err.message ?? String(err)));
