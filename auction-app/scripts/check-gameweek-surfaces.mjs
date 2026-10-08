/**
 * READ-ONLY standard check for the scoring surfaces (Leaderboard: Standings / My Points /
 * Competitors – Points). Makes no writes.
 *
 * 1) Data: for every locked gameweek of each auction, confirms the published pieces the
 *    leaderboard needs are all present — locked squads, player scores, auction_leaderboard
 *    rows, Best XI flags, the formation overlay file and registered match sheets (Match Pos).
 * 2) Code: scans leaderboard UI + scoring loaders for per-gameweek / per-auction special cases
 *    (e.g. `gw === 3`, hardcoded "GW2" labels) — a new gameweek must be data, never code — and
 *    the whole app for direct player-score reads outside lib/scoring/player-scores.ts or reads of
 *    the global Game_Weeks.Is_Active flag (both leak other competitions' points).
 *
 * Usage (from auction-app/):
 *   node scripts/check-gameweek-surfaces.mjs                 # auctions of active competitions
 *   node scripts/check-gameweek-surfaces.mjs --auction-ids 9,10
 *   node scripts/check-gameweek-surfaces.mjs --code-only
 * Exit code 1 if a published gameweek is missing a piece or code special-cases appear.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!process.env[key]) process.env[key] = line.slice(idx + 1).trim();
  }
}

function parseArgs(argv) {
  const opts = { auctionIds: null, codeOnly: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--code-only") opts.codeOnly = true;
    else if (argv[i] === "--auction-ids" && argv[i + 1]) {
      opts.auctionIds = argv[++i].split(",").map((n) => Number(n.trim()));
    } else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(1);
    }
  }
  return opts;
}

// ── 2) Code scan ─────────────────────────────────────────────────────────────
const CODE_SCOPE = [
  "app/auctions/[auctionId]/leaderboard",
  "lib/scoring/leaderboard-data.ts",
  "lib/scoring/best-xi-overlay.ts",
  "lib/scoring/best-xi-display.ts",
];
const CODE_PATTERNS = [
  { re: /\b(gw|gwId|gameWeekId|game_week_id|selectedGwId)\s*[!=]==?\s*\d+\b/, why: "compares a gameweek to a literal number" },
  { re: /\b(auctionId|auction_id)\s*[!=]==?\s*\d+\b/, why: "special-cases an auction id" },
  { re: /["'`][^"'`]*\b(Premier League|Champions League|World Cup)\b[^"'`]*\bGW\s?\d/i, why: "hardcoded gameweek label" },
  {
    re: /<ManagerChip\b/,
    why: "leaderboard manager links must use PointsManagerChip (ManagerChip defaults to Competitors – Bidding)",
    skip: /leaderboard\/_components\/PointsManagerChip\.tsx$/,
  },
];

function walk(p, out = []) {
  const abs = path.join(appRoot, p);
  if (!fs.existsSync(abs)) return out;
  if (fs.statSync(abs).isFile()) {
    out.push(abs);
    return out;
  }
  for (const name of fs.readdirSync(abs)) walk(path.join(p, name), out);
  return out;
}

// Score reads must go through lib/scoring/player-scores.ts with the auction's gameweek ids.
const SCORE_READ_SCOPE = ["app", "lib"];
const SCORE_READ_ALLOWED = new Set(["lib/scoring/player-scores.ts"]);
const SCORE_READ_PATTERNS = [
  { re: /from\(\s*["'`](Player_Scores|player_scores|player_scores_scoped)["'`]\s*\)/, why: "reads player scores directly — use readPlayerScores() from lib/scoring/player-scores.ts with the auction's gameweek ids" },
  { re: /["'`]Is_Active["'`]/, why: "reads the global Game_Weeks.Is_Active flag — it belongs to whichever competition locked last; use the auction's locked gameweeks" },
];

function scanScoreReads() {
  const hits = [];
  for (const file of SCORE_READ_SCOPE.flatMap((p) => walk(p))) {
    if (!/\.(tsx?|mjs)$/.test(file)) continue;
    const rel = path.relative(appRoot, file).split(path.sep).join("/");
    if (SCORE_READ_ALLOWED.has(rel)) continue;
    fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
        for (const { re, why } of SCORE_READ_PATTERNS) {
          if (re.test(line)) hits.push(`${rel}:${i + 1}  ${why}`);
        }
      });
  }
  return hits;
}

function scanCode() {
  const hits = [...scanScoreReads()];
  for (const file of CODE_SCOPE.flatMap((p) => walk(p))) {
    if (!/\.(tsx?|mjs)$/.test(file)) continue;
    fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
        const relFile = path.relative(appRoot, file).split(path.sep).join("/");
        for (const { re, why, skip } of CODE_PATTERNS) {
          if (skip && skip.test(relFile)) continue;
          if (re.test(line)) hits.push(`${path.relative(appRoot, file)}:${i + 1}  ${why}: ${line.trim()}`);
        }
      });
  }
  return hits;
}

// ── 1) Data check ────────────────────────────────────────────────────────────
function findCompetitionJson(slug) {
  for (const tier of ["active", "archive"]) {
    const p = path.join(repoRoot, "competitions", tier, slug, "competition.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  return null;
}

/** The competition's app sheet manifest (data/competitions/<slug>/sheets.json), or null. */
function sheetsManifest(slug) {
  const p = path.join(appRoot, "data/competitions", slug, "sheets.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

/** ordinal matchweek → number of registered match sheets (whose CSV exists). */
function registeredSheetsByOrdinal(slug) {
  const counts = new Map();
  const m = sheetsManifest(slug);
  for (const s of m?.sheets ?? []) {
    if (!fs.existsSync(path.join(appRoot, "data/competitions", slug, "match-scores", s.file))) continue;
    counts.set(Number(s.gw), (counts.get(Number(s.gw)) ?? 0) + 1);
  }
  return counts;
}

async function allRows(sb, table, cols, filter) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(sb.from(table).select(cols)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

async function checkAuction(sb, auction, comp) {
  const problems = [];
  const slug = comp?.slug ?? null;
  const manifest = slug ? findCompetitionJson(slug) : null;
  const gwStart = sheetsManifest(slug ?? "")?.legacy_game_week_start ?? manifest?.legacy_game_week_id_range?.[0] ?? null;
  const sheets = slug ? registeredSheetsByOrdinal(slug) : new Map();

  const squads = await allRows(sb, "gameweek_squads", "game_week_id, auction_user_id, player_id, is_best_xi", (q) =>
    q.eq("auction_id", auction.id),
  );
  const board = await allRows(sb, "auction_leaderboard", "game_week_id, auction_user_id", (q) => q.eq("auction_id", auction.id));
  const gws = [...new Set(squads.map((r) => r.game_week_id))].sort((a, b) => a - b);

  console.log(`\nAuction ${auction.id} — ${auction.name} (competition ${comp?.id ?? "none"} ${slug ?? ""}, ${comp?.status ?? "-"})`);
  if (!gws.length) console.log("  no locked gameweeks yet");

  for (const gw of gws) {
    const rows = squads.filter((r) => r.game_week_id === gw);
    const managers = new Set(rows.map((r) => r.auction_user_id)).size;
    const boardRows = board.filter((r) => r.game_week_id === gw).length;
    const xi = rows.filter((r) => r.is_best_xi).length;
    const ids = [...new Set(rows.map((r) => Number(r.player_id)))];
    let scored = 0;
    for (let i = 0; i < ids.length; i += 300) {
      const { count, error } = await sb
        .from("Player_Scores")
        .select("player_id", { count: "exact", head: true })
        .eq("game_week_id", gw)
        .in("player_id", ids.slice(i, i + 300));
      if (error) throw new Error(`Player_Scores: ${error.message}`);
      scored += count ?? 0;
    }
    const overlayPath = path.join(appRoot, "data/best-xi", `auction-${auction.id}-gw${gw}.json`);
    let overlay = "missing";
    if (fs.existsSync(overlayPath)) {
      const o = JSON.parse(fs.readFileSync(overlayPath, "utf8"));
      overlay = Number(o.gw_id) === gw && Number(o.auction_id) === auction.id ? "ok" : `wrong ids (auction ${o.auction_id}, gw ${o.gw_id})`;
    }
    const ordinal = gwStart != null ? gw - gwStart + 1 : null;
    const sheetCount = ordinal != null ? sheets.get(ordinal) ?? 0 : 0;

    const published = boardRows > 0;
    const state = published ? (boardRows === managers ? "published" : `PARTIAL (${boardRows}/${managers} managers)`) : "not published";
    console.log(
      `  GW ${gw} (MW${ordinal ?? "?"}): ${state} · squads ${rows.length} rows/${managers} managers · scores ${scored}/${ids.length} players · ` +
        `Best XI flags ${xi} · overlay ${overlay} · match sheets ${sheetCount}`,
    );
    if (published) {
      if (boardRows !== managers) problems.push(`GW ${gw}: leaderboard rows ${boardRows} ≠ managers ${managers}`);
      if (!xi) problems.push(`GW ${gw}: no Best XI flags in gameweek_squads`);
      if (overlay !== "ok") problems.push(`GW ${gw}: formation overlay ${overlay} (data/best-xi/auction-${auction.id}-gw${gw}.json)`);
      if (!sheetCount) problems.push(`GW ${gw}: no match sheets registered for MW${ordinal} → Match Pos will be blank`);
      if (!scored) problems.push(`GW ${gw}: no Player_Scores for the locked squad`);
    }
  }
  return problems.map((p) => `Auction ${auction.id} ${p}`);
}

async function main() {
  const opts = parseArgs(process.argv);
  const issues = [];

  const codeHits = scanCode();
  console.log("── Code scan (score access + leaderboard UI + scoring loaders) ──");
  console.log(codeHits.length ? codeHits.map((h) => `  ✗ ${h}`).join("\n") : "  ✓ scores only read via lib/scoring/player-scores.ts; no per-gameweek / per-auction special cases");
  issues.push(...codeHits);

  if (!opts.codeOnly) {
    loadEnvLocal();
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: comps, error: cErr } = await sb.from("competitions").select("id, slug, status");
    if (cErr) throw new Error(cErr.message);
    const compById = new Map(comps.map((c) => [Number(c.id), c]));
    let q = sb.from("Auctions").select("id, name, competition_id").order("id");
    q = opts.auctionIds
      ? q.in("id", opts.auctionIds)
      : q.in("competition_id", comps.filter((c) => c.status === "active").map((c) => c.id));
    const { data: auctions, error: aErr } = await q;
    if (aErr) throw new Error(aErr.message);

    console.log("\n── Gameweek data per auction ──");
    for (const a of auctions) issues.push(...(await checkAuction(sb, a, compById.get(Number(a.competition_id)))));
  }

  console.log(`\n${issues.length ? `✗ ${issues.length} issue(s):\n  ${issues.join("\n  ")}` : "✓ All checks passed"}`);
  process.exitCode = issues.length ? 1 : 0;
}

main().catch((err) => {
  console.error("❌", err.message ?? err);
  process.exitCode = 1;
});
