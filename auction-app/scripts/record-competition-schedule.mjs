/**
 * Record a competition's gameweek schedule (bidding deadlines + first kickoff) into
 * Supabase competition_rounds, from competitions/<tier>/<slug>/schedule.json.
 *
 * The app uses this to work out which gameweek a newly started auction plays from.
 * Record the whole season in advance; re-running is safe (unchanged rows are skipped).
 *
 * Usage (from auction-app/):
 *   node scripts/record-competition-schedule.mjs --competition uefa-cl-2026-27          # dry run
 *   node scripts/record-competition-schedule.mjs --competition uefa-cl-2026-27 --apply
 *
 * Writes ONLY competition_rounds rows of that competition. Refuses archived competitions.
 * Schema: scripts/sql/competition-round-schedule.sql.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "..");

const SCHEDULE_FIELDS = ["initiation_deadline_at", "raise_deadline_at", "hard_deadline_at", "first_kickoff_at"];
/** New auctions need at least this many future gameweeks on record (product rule). */
const MIN_FUTURE_ROUNDS = 2;
const TZ = "Europe/Dublin";

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { competition: null, apply: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") opts.apply = true;
    else if (a === "--competition" && argv[i + 1]) opts.competition = argv[++i];
    else fail(`Unknown argument: ${a}`);
  }
  if (!opts.competition) fail("--competition <slug> is required");
  return opts;
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

/** Minutes east of UTC that Europe/Dublin observes at this instant (60 in summer, 0 in winter). */
function dublinOffsetMinutes(ms) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, timeZoneName: "longOffset" }).formatToParts(new Date(ms));
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Offset written in the ISO string itself, in minutes (Z → 0). Null when the string has none. */
function writtenOffsetMinutes(iso) {
  const m = /(Z|([+-])(\d{2}):(\d{2}))$/.exec(iso);
  if (!m) return null;
  if (m[1] === "Z") return 0;
  return (m[2] === "-" ? -1 : 1) * (Number(m[3]) * 60 + Number(m[4]));
}

const fmtIrish = (ms) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));

function validateSchedule(schedule, competition) {
  if (schedule.competition_slug !== competition.slug) {
    fail(`schedule.json names ${schedule.competition_slug}, expected ${competition.slug}`);
  }
  const rounds = schedule.rounds ?? [];
  if (!rounds.length) fail("schedule.json has no rounds");
  const [legacyStart, legacyEnd] = competition.legacy_game_week_id_range ?? [];
  if (!Number.isFinite(legacyStart)) fail("competition.json has no legacy_game_week_id_range");

  const seen = new Set();
  let prevKickoff = -Infinity;
  return rounds.map((r) => {
    const label = r.round_slug ?? "(no slug)";
    if (!/^mw\d{2}$/.test(r.round_slug ?? "")) fail(`${label}: round_slug must look like mw02`);
    if (!Number.isInteger(r.round_number) || r.round_number < 1) fail(`${label}: round_number must be a positive integer`);
    if (r.round_slug !== `mw${String(r.round_number).padStart(2, "0")}`) fail(`${label}: round_slug does not match round_number ${r.round_number}`);
    if (seen.has(r.round_number)) fail(`${label}: round_number ${r.round_number} listed twice`);
    seen.add(r.round_number);

    const ms = {};
    for (const f of SCHEDULE_FIELDS) {
      const iso = r[f];
      if (typeof iso !== "string" || Number.isNaN(Date.parse(iso))) fail(`${label}: ${f} is not an ISO date (${iso})`);
      const written = writtenOffsetMinutes(iso);
      if (written == null) fail(`${label}: ${f} must carry an explicit UTC offset, e.g. +01:00 (${iso})`);
      ms[f] = Date.parse(iso);
      const actual = dublinOffsetMinutes(ms[f]);
      if (written !== actual) {
        fail(`${label}: ${f} is written with offset ${written / 60}h but Irish time on that date is UTC${actual >= 0 ? "+" : ""}${actual / 60} (${iso})`);
      }
    }
    if (!(ms.initiation_deadline_at <= ms.raise_deadline_at && ms.raise_deadline_at <= ms.hard_deadline_at && ms.hard_deadline_at <= ms.first_kickoff_at)) {
      fail(`${label}: must be initiation ≤ raise ≤ hard ≤ first kickoff`);
    }
    if (ms.initiation_deadline_at <= prevKickoff) fail(`${label}: starts before the previous round's first kickoff — rounds must be in order`);
    prevKickoff = ms.first_kickoff_at;

    const legacyId = legacyStart + r.round_number - 1;
    if (Number.isFinite(legacyEnd) && legacyId > legacyEnd) fail(`${label}: legacy id ${legacyId} is outside ${legacyStart}–${legacyEnd}`);

    return {
      round_slug: r.round_slug,
      round_number: r.round_number,
      display_name: r.display_name ?? `Matchweek ${r.round_number}`,
      legacy_game_week_id: legacyId,
      ...Object.fromEntries(SCHEDULE_FIELDS.map((f) => [f, new Date(ms[f]).toISOString()])),
      _ms: ms,
    };
  });
}

/** Compare with the round manifest's bidding block (the window gameweek.mjs opens). Warn only. */
function roundJsonMismatch(compDir, row) {
  const p = path.join(compDir, "rounds", row.round_slug, "round.json");
  if (!fs.existsSync(p)) return null;
  const b = readJson(p).bidding;
  if (!b) return null;
  const diffs = ["initiation_deadline_at", "raise_deadline_at", "hard_deadline_at"].filter(
    (f) => b[f] && Date.parse(b[f]) !== row._ms[f],
  );
  return diffs.length ? `round.json bidding differs on ${diffs.join(", ")}` : "matches round.json";
}

const sameInstant = (a, b) => (a == null && b == null) || (a != null && b != null && Date.parse(a) === Date.parse(b));

async function main() {
  const opts = parseArgs(process.argv);
  const activeDir = path.join(repoRoot, "competitions", "active", opts.competition);
  if (!fs.existsSync(activeDir)) {
    if (fs.existsSync(path.join(repoRoot, "competitions", "archive", opts.competition))) {
      fail(`${opts.competition} is archived — its schedule is read-only`);
    }
    fail(`Competition not found: ${opts.competition}`);
  }
  const competition = readJson(path.join(activeDir, "competition.json"));
  const schedulePath = path.join(activeDir, "schedule.json");
  if (!fs.existsSync(schedulePath)) fail(`Missing ${path.relative(repoRoot, schedulePath)}`);
  const rows = validateSchedule(readJson(schedulePath), competition);
  const competitionId = Number(competition.database_competition_id);

  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in auction-app/.env.local");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: comp, error: cErr } = await sb.from("competitions").select("id, slug, status").eq("id", competitionId).maybeSingle();
  if (cErr) fail(`competitions: ${cErr.message}`);
  if (!comp) fail(`competition id ${competitionId} not found in Supabase`);
  if (comp.status === "archived") fail(`competition ${competitionId} is archived in Supabase — refusing`);

  const { data: existing, error: eErr } = await sb
    .from("competition_rounds")
    .select(`id, round_slug, round_number, display_name, legacy_game_week_id, ${SCHEDULE_FIELDS.join(", ")}`)
    .eq("competition_id", competitionId);
  if (eErr) {
    if (/column .* does not exist/i.test(eErr.message)) fail(`${eErr.message} — run scripts/sql/competition-round-schedule.sql first`);
    fail(`competition_rounds: ${eErr.message}`);
  }
  const bySlug = new Map((existing ?? []).map((r) => [r.round_slug, r]));

  console.log(`\nSCHEDULE ${competition.slug} (competition ${competitionId})${opts.apply ? "" : "  (DRY RUN — add --apply to write)"}`);
  console.log("Times shown in Irish time.\n");

  const plan = [];
  for (const row of rows) {
    const cur = bySlug.get(row.round_slug);
    let action = "insert";
    if (cur) {
      if (cur.legacy_game_week_id != null && Number(cur.legacy_game_week_id) !== row.legacy_game_week_id) {
        fail(`${row.round_slug}: existing row has legacy id ${cur.legacy_game_week_id}, schedule implies ${row.legacy_game_week_id} — fix by hand, not here`);
      }
      const changed =
        cur.display_name !== row.display_name ||
        Number(cur.round_number) !== row.round_number ||
        cur.legacy_game_week_id == null ||
        SCHEDULE_FIELDS.some((f) => !sameInstant(cur[f], row[f]));
      action = changed ? "update" : "unchanged";
    }
    plan.push({ row, cur, action });
    const m = row._ms;
    const check = roundJsonMismatch(activeDir, row);
    console.log(
      `  ${row.round_slug}  ${row.display_name.padEnd(12)}  GW id ${row.legacy_game_week_id}  ` +
        `initiation ${fmtIrish(m.initiation_deadline_at)} · raise ${fmtIrish(m.raise_deadline_at)} · ` +
        `hard ${fmtIrish(m.hard_deadline_at)} · kickoff ${fmtIrish(m.first_kickoff_at)}  → ${action}` +
        (check ? `  (${check})` : ""),
    );
  }

  const unlisted = (existing ?? []).filter((r) => !rows.some((x) => x.round_slug === r.round_slug));
  if (unlisted.length) console.log(`\n  Rows in DB not in schedule.json (left untouched): ${unlisted.map((r) => r.round_slug).join(", ")}`);

  const now = Date.now();
  const future = rows.filter((r) => r._ms.initiation_deadline_at > now);
  console.log(
    `\n  Future gameweeks on record: ${future.length} (${future.map((r) => r.round_slug).join(", ") || "none"}) — ` +
      (future.length >= MIN_FUTURE_ROUNDS ? "✓ enough for new auctions" : `⚠️ new auctions need at least ${MIN_FUTURE_ROUNDS}`),
  );

  if (!opts.apply) return console.log("\n(DRY RUN — nothing written)");

  for (const { row, cur, action } of plan) {
    if (action === "unchanged") continue;
    const values = {
      round_number: row.round_number,
      display_name: row.display_name,
      legacy_game_week_id: row.legacy_game_week_id,
      ...Object.fromEntries(SCHEDULE_FIELDS.map((f) => [f, row[f]])),
    };
    const res =
      action === "insert"
        ? await sb.from("competition_rounds").insert({ competition_id: competitionId, round_slug: row.round_slug, status: "scheduled", is_active: false, ...values })
        : await sb.from("competition_rounds").update(values).eq("id", cur.id).eq("competition_id", competitionId);
    if (res.error) fail(`${row.round_slug} ${action}: ${res.error.message}`);
    console.log(`  ${row.round_slug}: ✅ ${action === "insert" ? "inserted" : "updated"}`);
  }
  console.log("\n✅ Schedule recorded.");
}

main().catch((err) => fail(err.message ?? String(err)));
