/**
 * Build the precomputed Stats files for a competition (read-only on Supabase; writes local JSON).
 *
 * The in-auction Stats page reads these files and never queries scores itself, so a page refresh
 * costs nothing. Run after a gameweek is published — `gameweek.mjs best-xi --apply` calls this.
 *
 * Usage (from auction-app/):
 *   node scripts/build-auction-stats.mjs --competition <slug> --through <mwNN> [--dry-run]
 *
 * Writes (committed + deployed with the gameweek's other data files):
 *   data/competitions/<slug>/stats/players.json        per player, per gameweek: points + minutes
 *   data/competitions/<slug>/stats/auction-<id>.json   per auction: ownership stints from locked squads
 *
 * Sources:
 *   points   Supabase "Player_Scores" (what the leaderboard uses), by legacy gameweek id
 *   minutes  scoring intermediates in competitions/<tier>/<slug>/rounds/<round>/matches/<match>/intermediates/
 *            (*_Outfield_Points.csv minutes_played_derived; keeper units = sum of *_KeeperPoints.csv minutes)
 *   names    competition_players (listed position, club)
 *   squads   gameweek_squads (who owned whom at each gameweek's lock, and the price paid)
 *
 * Only rounds mw01..<through> are included, so an unpublished (partly scored) round never leaks in.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { loadCompetitionAuctions, auctionsPlayingRound } from "./lib/gameweek-auctions.mjs";
import { KEEPER_SYNTHETIC_OFFSET } from "./lib/keeper-player-id.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { competition: null, through: null, dryRun: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--competition" && rest[i + 1]) opts.competition = rest[++i];
    else if (a === "--through" && rest[i + 1]) opts.through = rest[++i];
    else fail(`Unknown argument: ${a}`);
  }
  if (!opts.competition || !opts.through) fail("--competition <slug> and --through <mwNN> are required");
  if (!/^mw\d{2}$/.test(opts.through)) fail(`--through must look like mw04 (got ${opts.through})`);
  return opts;
}

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!process.env[key]) process.env[key] = line.slice(idx + 1).trim();
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Minimal CSV reader (quoted fields supported) → array of objects keyed by header. */
function readCsv(p) {
  const lines = fs.readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l.trim() !== "");
  const parse = (line) => {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else q = !q;
      } else if (ch === "," && !q) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const header = parse(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = parse(l);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}

function findCompetitionDir(slug) {
  for (const tier of ["active", "archive"]) {
    const dir = path.join(repoRoot, "competitions", tier, slug);
    if (fs.existsSync(path.join(dir, "competition.json"))) return dir;
  }
  fail(`competitions/<active|archive>/${slug}/competition.json not found`);
}

/** Page through a Supabase select (default page size is 1000 rows). */
async function selectAll(build) {
  const rows = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < size) return rows;
  }
}

function listedPos(position) {
  const p = String(position ?? "").toLowerCase();
  if (p.includes("goalkeeper") || p === "gk") return "GK";
  if (p.includes("defend")) return "DEF";
  if (p.includes("midfield")) return "MID";
  if (p.includes("forward")) return "FWD";
  return null;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Minutes per (score) player id for one round, from the scoring intermediates. */
function minutesForRound(roundDir, round) {
  const minutes = new Map();
  const add = (id, m) => minutes.set(id, (minutes.get(id) ?? 0) + m);
  for (const f of round.fixtures ?? []) {
    if (f.status !== "scored") continue;
    const inter = path.join(roundDir, "matches", f.match_slug, "intermediates");
    if (!fs.existsSync(inter)) fail(`${round.round_slug}/${f.match_slug}: intermediates folder missing`);
    const files = fs.readdirSync(inter);
    const outfield = files.find((n) => n.endsWith("_Outfield_Points.csv"));
    const keepers = files.find((n) => n.endsWith("_KeeperPoints.csv"));
    if (!outfield || !keepers) fail(`${round.round_slug}/${f.match_slug}: Outfield/Keeper points file missing`);
    for (const r of readCsv(path.join(inter, outfield))) {
      const m = Number(r.minutes_played_derived);
      if (Number.isFinite(m)) add(Number(r.player_id), m);
    }
    // Keeper units: one fantasy "player" per club (id 90_000_000 + team_id) — sum its keepers' minutes.
    for (const r of readCsv(path.join(inter, keepers))) {
      const m = Number(r.minutes_played);
      if (Number.isFinite(m)) add(KEEPER_SYNTHETIC_OFFSET + Number(r.team_id), m);
    }
  }
  return minutes;
}

async function main() {
  const opts = parseArgs(process.argv);
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (auction-app/.env.local)");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const compDir = findCompetitionDir(opts.competition);
  const competition = readJson(path.join(compDir, "competition.json"));
  const competitionId = Number(competition.database_competition_id ?? competition.competition_id);
  if (!Number.isFinite(competitionId)) fail("competition.json has no database_competition_id");

  // ── rounds mw01..through ────────────────────────────────────────────────────
  const throughNum = Number(opts.through.slice(2));
  const rounds = [];
  for (let n = 1; n <= throughNum; n += 1) {
    const slug = `mw${String(n).padStart(2, "0")}`;
    const roundDir = path.join(compDir, "rounds", slug);
    const roundPath = path.join(roundDir, "round.json");
    if (!fs.existsSync(roundPath)) fail(`${slug}/round.json missing`);
    const round = readJson(roundPath);
    const gw = Number(round.legacy_game_week_id);
    if (!Number.isFinite(gw)) fail(`${slug}: no legacy_game_week_id`);
    const scored = (round.fixtures ?? []).filter((f) => f.status === "scored").length;
    if (round.expected_match_count && scored < round.expected_match_count) {
      fail(`${slug}: only ${scored}/${round.expected_match_count} matches scored — publish it before building stats`);
    }
    rounds.push({ slug, number: n, gw, dir: roundDir, round });
  }
  const gwIds = rounds.map((r) => r.gw);

  // ── players: listed position + club ─────────────────────────────────────────
  const pool = await selectAll(() =>
    sb.from("competition_players").select("player_id, player_name, position, team_name").eq("competition_id", competitionId).order("player_id"),
  );
  const poolById = new Map(pool.map((p) => [Number(p.player_id), p]));

  // ── points + minutes per round ──────────────────────────────────────────────
  const players = new Map(); // id → { id, name, club, pos, gw: { [gwId]: [pts, min] } }
  const missingMinutes = [];
  for (const r of rounds) {
    const scores = await selectAll(() =>
      sb.from("Player_Scores").select("player_id, Score").eq("game_week_id", r.gw).order("player_id"),
    );
    if (!scores.length) fail(`${r.slug}: no Player_Scores for GW ${r.gw} — upload scores first`);
    const minutes = minutesForRound(r.dir, r.round);
    // Fallback identity for scored players who are not in the auction pool (not biddable).
    const fpById = new Map();
    for (const f of r.round.fixtures ?? []) {
      if (f.status !== "scored") continue;
      const csv = path.join(r.dir, "matches", f.match_slug, "final-points.csv");
      if (!fs.existsSync(csv)) fail(`${r.slug}/${f.match_slug}: final-points.csv missing`);
      for (const row of readCsv(csv)) {
        const isKeeper = String(row.position).toLowerCase() === "goalkeeper";
        const id = isKeeper ? KEEPER_SYNTHETIC_OFFSET + Number(row.player_id) : Number(row.player_id);
        fpById.set(id, { player_name: row.player_name, team_name: row.team_name, position: row.position });
      }
    }
    for (const s of scores) {
      const id = Number(s.player_id);
      const pts = Number(s.Score) || 0;
      const min = minutes.get(id);
      if (min == null) {
        if (pts !== 0) missingMinutes.push(`${r.slug}:${id}`);
        continue;
      }
      if (min <= 0 && pts === 0) continue; // unused sub
      const p = poolById.get(id) ?? fpById.get(id);
      if (!p) fail(`${r.slug}: player ${id} has a score but no identity in competition_players or FinalPoints`);
      if (!players.has(id)) {
        players.set(id, {
          id,
          name: p.player_name,
          club: p.team_name,
          pos: listedPos(p.position),
          // false = scored in a match but not in the auction pool (cannot be bought)
          pool: poolById.has(id),
          gw: {},
        });
      }
      players.get(id).gw[r.gw] = [round2(pts), Math.round(min)];
    }
  }
  if (missingMinutes.length) {
    fail(`scores with no minutes in the intermediates (ids differ?): ${missingMinutes.slice(0, 10).join(", ")}${missingMinutes.length > 10 ? " …" : ""}`);
  }
  const noPos = [...players.values()].filter((p) => !p.pos);
  if (noPos.length) fail(`players without a listed position: ${noPos.slice(0, 5).map((p) => p.name).join(", ")}`);

  const gameweeks = rounds.map((r) => ({ id: r.gw, round: r.number, label: `GW${r.number}` }));
  const builtAt = new Date().toISOString();
  const playersFile = {
    competition: opts.competition,
    competitionId,
    builtAt,
    through: opts.through,
    gameweeks,
    players: [...players.values()].sort((a, b) => a.id - b.id),
  };

  // ── auctions: ownership stints from locked squads ───────────────────────────
  const auctions = auctionsPlayingRound(await loadCompetitionAuctions(sb, competitionId), throughNum);
  const auctionFiles = [];
  for (const a of auctions) {
    const auctionGws = rounds.filter((r) => r.number >= a.start_round_number).map((r) => r.gw);
    const rows = auctionGws.length
      ? await selectAll(() =>
          sb
            .from("gameweek_squads")
            .select("game_week_id, auction_user_id, player_id, purchase_price")
            .eq("auction_id", a.id)
            .in("game_week_id", auctionGws)
            .order("id"),
        )
      : [];
    for (const gw of auctionGws) {
      if (!rows.some((r) => Number(r.game_week_id) === gw)) fail(`auction ${a.id}: GW ${gw} has no locked squads`);
    }
    // One stint = same manager + player + price across the gameweeks they held him at lock.
    const stints = new Map();
    for (const r of rows) {
      const k = `${r.auction_user_id}|${r.player_id}|${r.purchase_price}`;
      if (!stints.has(k)) {
        stints.set(k, { player: Number(r.player_id), manager: Number(r.auction_user_id), price: Number(r.purchase_price), gws: [] });
      }
      stints.get(k).gws.push(Number(r.game_week_id));
    }
    for (const s of stints.values()) s.gws.sort((x, y) => x - y);
    auctionFiles.push({
      auctionId: a.id,
      competition: opts.competition,
      builtAt,
      through: opts.through,
      gameweeks: auctionGws,
      stints: [...stints.values()].sort((x, y) => x.manager - y.manager || x.player - y.player),
    });
  }

  // ── write ───────────────────────────────────────────────────────────────────
  const outDir = path.join(appRoot, "data", "competitions", opts.competition, "stats");
  console.log(`stats for ${opts.competition} through ${opts.through} (GW ids ${gwIds.join(", ")})`);
  console.log(`  players.json: ${playersFile.players.length} players with minutes or points`);
  for (const f of auctionFiles) console.log(`  auction-${f.auctionId}.json: ${f.stints.length} ownership stints over ${f.gameweeks.length} GW(s)`);
  if (opts.dryRun) {
    console.log("(DRY RUN — nothing written)");
    return;
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "players.json"), JSON.stringify(playersFile));
  for (const f of auctionFiles) fs.writeFileSync(path.join(outDir, `auction-${f.auctionId}.json`), JSON.stringify(f));
  console.log(`✅ wrote ${path.relative(repoRoot, outDir)}`);
}

main().catch((err) => fail(err.message ?? String(err)));
