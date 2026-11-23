/**
 * Build the data file for the public HFW Stats dashboard (football stats only — no auction data).
 *
 * Reads the raw FotMob match files already stored with each scored match and writes one small
 * data file the static dashboard page loads. Nothing runs this automatically: the dashboard only
 * changes when you run it (normally once a gameweek is fully scored) and commit the output.
 * Touches no database.
 *
 * Usage (from auction-app/):
 *   node scripts/build-public-stats.mjs --competition uefa-cl-2026-27 --through mw04 [--dry-run]
 *
 * Reads:
 *   competitions/<tier>/<slug>/rounds/mwNN/round.json                       fixtures with status "scored"
 *   competitions/<tier>/<slug>/rounds/mwNN/matches/<match>/intermediates/*.json   raw FotMob match (content.playerStats)
 *   competitions/<tier>/<slug>/player-pool/master_player_list.csv           listed position + club
 *
 * Writes:
 *   public/hfw-stats/<slug>/data.js     window.HFW_STATS = { ... }  (the page is public/hfw-stats/<slug>/index.html)
 *
 * Positions are LISTED positions: the player pool (taken from FotMob squad pages), else the
 * position FotMob gives the player most often (usualPosition). Never the position played in a match.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/** Minimal CSV reader (quoted fields supported, BOM stripped) → array of objects keyed by header. */
function readCsv(p) {
  const text = fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
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

/** FotMob titles → [value, total]. A stat FotMob leaves out for a player who played counts as 0. */
function flattenStats(player) {
  const flat = new Map();
  for (const group of player.stats ?? []) {
    for (const [title, entry] of Object.entries(group.stats ?? {})) {
      if (flat.has(title)) continue; // some titles repeat across groups with the same value
      const s = entry?.stat ?? {};
      const value = Number(s.value);
      const total = Number(s.total);
      flat.set(title, [Number.isFinite(value) ? value : 0, Number.isFinite(total) ? total : 0]);
    }
  }
  return flat;
}

// Column order is the contract with index.html (STAT_COLUMNS there).
const OUTFIELD = [
  ["tkl", "Tackles", "value"],
  ["int", "Interceptions", "value"],
  ["kp", "Chances created", "value"],
  ["pass", "Accurate passes", "value"],
  ["passAtt", "Accurate passes", "total"],
  ["crs", "Accurate crosses", "value"],
  ["f3", "Passes into final third", "value"],
  ["g", "Goals", "value"],
  ["sot", "Shots on target", "value"],
  ["a", "Assists", "value"],
  ["drb", "Successful dribbles", "value"],
  ["aer", "Aerial duels won", "value"],
  ["aerAtt", "Aerial duels won", "total"],
  ["clr", "Clearances", "value"], // FotMob's count already includes headed clearances
];
const KEEPER = [
  ["sav", "Saves", "value"],
  ["clm", "High claim", "value"],
  ["pun", "Punches", "value"],
  ["pass", "Accurate passes", "value"],
  ["passAtt", "Accurate passes", "total"],
  ["gc", "Goals conceded", "value"],
];

const POOL_POS = { Goalkeeper: "GK", Defender: "DEF", Midfielder: "MID", Forward: "FWD" };
const USUAL_POS = { 0: "GK", 1: "DEF", 2: "MID", 3: "FWD" };

function main() {
  const opts = parseArgs(process.argv);
  const compDir = findCompetitionDir(opts.competition);
  const competition = readJson(path.join(compDir, "competition.json"));

  // ── listed positions from the player pool ───────────────────────────────────
  const poolCsv = path.join(compDir, "player-pool", "master_player_list.csv");
  if (!fs.existsSync(poolCsv)) fail(`${path.relative(repoRoot, poolCsv)} missing`);
  const pool = new Map();
  for (const r of readCsv(poolCsv)) {
    const pos = POOL_POS[r.position];
    if (pos) pool.set(Number(r.player_id), pos);
  }

  // ── rounds mw01..through, every scored fixture ──────────────────────────────
  const throughNum = Number(opts.through.slice(2));
  const players = new Map(); // id → accumulator
  const seenMatches = new Set();
  const rounds = [];
  for (let n = 1; n <= throughNum; n += 1) {
    const slug = `mw${String(n).padStart(2, "0")}`;
    const roundDir = path.join(compDir, "rounds", slug);
    const roundPath = path.join(roundDir, "round.json");
    if (!fs.existsSync(roundPath)) fail(`${slug}/round.json missing`);
    const round = readJson(roundPath);
    const fixtures = (round.fixtures ?? []).filter((f) => f.status === "scored");
    const unscored = (round.fixtures ?? []).length - fixtures.length;
    if (!fixtures.length) fail(`${slug}: no scored matches`);
    if (round.expected_match_count && fixtures.length < round.expected_match_count) {
      fail(`${slug}: only ${fixtures.length}/${round.expected_match_count} matches scored`);
    }

    for (const f of fixtures) {
      const key = String(f.fotmob_match_id ?? f.match_slug);
      if (seenMatches.has(key)) fail(`${slug}/${f.match_slug}: match ${key} already counted in an earlier round`);
      seenMatches.add(key);
      const inter = path.join(roundDir, "matches", f.match_slug, "intermediates");
      if (!fs.existsSync(inter)) fail(`${slug}/${f.match_slug}: intermediates folder missing`);
      const raw = fs
        .readdirSync(inter)
        .filter((name) => name.endsWith(".json") && !name.endsWith(".manifest.json"))
        .map((name) => readJson(path.join(inter, name)))
        .find((d) => d?.content?.playerStats);
      if (!raw) fail(`${slug}/${f.match_slug}: no raw FotMob match file with playerStats`);

      for (const p of Object.values(raw.content.playerStats)) {
        const flat = flattenStats(p);
        const minutes = flat.get("Minutes played")?.[0] ?? 0;
        if (minutes <= 0) continue; // unused substitute
        const id = Number(p.id);
        if (!players.has(id)) {
          players.set(id, {
            id,
            name: p.name,
            club: p.teamName,
            lastRound: 0,
            usual: new Map(),
            keeperGames: 0,
            minutes: 0,
            apps: 0,
            out: Object.fromEntries(OUTFIELD.map(([k]) => [k, 0])),
            gk: Object.fromEntries(KEEPER.map(([k]) => [k, 0])),
          });
        }
        const acc = players.get(id);
        if (n >= acc.lastRound) {
          acc.lastRound = n;
          acc.club = p.teamName; // latest club they played for
          acc.name = p.name;
        }
        if (p.usualPosition != null) acc.usual.set(p.usualPosition, (acc.usual.get(p.usualPosition) ?? 0) + 1);
        if (p.isGoalkeeper) acc.keeperGames += 1;
        acc.minutes += minutes;
        acc.apps += 1;
        for (const [k, title, part] of OUTFIELD) acc.out[k] += flat.get(title)?.[part === "value" ? 0 : 1] ?? 0;
        for (const [k, title, part] of KEEPER) acc.gk[k] += flat.get(title)?.[part === "value" ? 0 : 1] ?? 0;
      }
    }
    rounds.push({ slug, number: n, matches: fixtures.length, unscored });
  }

  // ── listed position: pool first, else FotMob's most common usualPosition ────
  const fromFotmob = [];
  const outfield = [];
  const keepers = [];
  for (const acc of players.values()) {
    let pos = pool.get(acc.id);
    let src = "pool";
    if (!pos) {
      const best = [...acc.usual.entries()].sort((x, y) => y[1] - x[1])[0];
      pos = best ? USUAL_POS[best[0]] : acc.keeperGames > 0 ? "GK" : null;
      src = "fotmob";
      fromFotmob.push(`${acc.name} (${acc.club}) → ${pos ?? "?"}`);
    }
    if (!pos) fail(`${acc.name} (${acc.club}): no listed position in the pool or FotMob`);
    const base = [acc.id, acc.name, acc.club, pos, src === "pool" ? 1 : 0, Math.round(acc.minutes), acc.apps];
    if (pos === "GK") keepers.push([...base, ...KEEPER.map(([k]) => acc.gk[k])]);
    else outfield.push([...base, ...OUTFIELD.map(([k]) => acc.out[k])]);
  }
  const byName = (x, y) => String(x[1]).localeCompare(String(y[1]));
  outfield.sort(byName);
  keepers.sort(byName);

  const data = {
    competition: competition.display_name ?? competition.name ?? opts.competition,
    slug: opts.competition,
    through: opts.through,
    throughLabel: `GW${throughNum}`,
    builtAt: new Date().toISOString(),
    rounds: rounds.map((r) => ({ label: `GW${r.number}`, matches: r.matches })),
    matches: seenMatches.size,
    columns: {
      base: ["id", "name", "club", "pos", "poolPos", "min", "apps"],
      outfield: OUTFIELD.map(([k]) => k),
      keeper: KEEPER.map(([k]) => k),
    },
    outfield,
    keepers,
  };

  const outDir = path.join(appRoot, "public", "hfw-stats", opts.competition);
  const outFile = path.join(outDir, "data.js");
  console.log(`public stats for ${opts.competition} through ${opts.through}`);
  for (const r of rounds) console.log(`  ${r.slug}: ${r.matches} matches${r.unscored ? ` (${r.unscored} not scored yet, skipped)` : ""}`);
  console.log(`  ${outfield.length} outfield players, ${keepers.length} goalkeepers with minutes`);
  console.log(`  ${fromFotmob.length} positions from FotMob (not in the player pool)`);
  if (opts.dryRun) {
    for (const line of fromFotmob) console.log(`    ${line}`);
    console.log("(DRY RUN — nothing written)");
    return;
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, `window.HFW_STATS = ${JSON.stringify(data)};\n`);
  console.log(`✅ wrote ${path.relative(repoRoot, outFile)} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
}

main();
