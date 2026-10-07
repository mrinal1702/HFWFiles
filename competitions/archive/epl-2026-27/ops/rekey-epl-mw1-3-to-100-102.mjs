/**
 * One-off (Oct 2026): move EPL 2026/27 MW1–MW3 from legacy game_week_id 1/2/3 to
 * 100/101/102 (EPL's reserved range), freeing 1–3 for the World Cup 2026 scores they
 * had overwritten.
 *
 * Touches only:
 *   - "Player_Scores" rows with game_week_id 1–3 (all EPL; verified before running)
 *   - gameweek_squads / auction_leaderboard rows for auction 9 at GW 1–3
 *   - "Game_Weeks" rows 1–3 (renamed back to World Cup) + new rows 100–102
 *   - competition_rounds id 101 (EPL MW1) legacy_game_week_id 1 → 100
 * Does NOT touch Is_Active, UCL (GW 300, auctions 10–13) or World Cup leaderboard rows.
 *
 * Writes a JSON backup of every affected row first.
 *
 * Run from auction-app/ (needs node_modules + .env.local):
 *   node ../competitions/archive/epl-2026-27/ops/rekey-epl-mw1-3-to-100-102.mjs --dry-run
 *   node ../competitions/archive/epl-2026-27/ops/rekey-epl-mw1-3-to-100-102.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const appRoot = path.resolve(process.cwd());
const require = createRequire(path.join(appRoot, "package.json"));
const { createClient } = require("@supabase/supabase-js");

for (const l of fs.readFileSync(path.join(appRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.trim().startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim();
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DRY = process.argv.includes("--dry-run");
const MAP = { 1: 100, 2: 101, 3: 102 };
const EPL_AUCTION = 9;
const EPL_NAMES = { 100: "Premier League GW1", 101: "Premier League GW2", 102: "Premier League GW3" };
const WC_NAMES = {
  1: "FIFA World Cup Group Stage GW1",
  2: "FIFA World Cup Group Stage GW2",
  3: "FIFA World Cup Group Stage GW3",
};
const backupDir = path.resolve(appRoot, "../competitions/archive/epl-2026-27/ops/backups");

async function all(table, build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(sb.from(table).select("*")).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
function must({ error }, label) {
  if (error) throw new Error(`${label}: ${error.message}`);
}
async function standings() {
  const rows = await all("auction_leaderboard", (q) => q.eq("auction_id", EPL_AUCTION));
  const by = {};
  for (const r of rows) by[r.auction_user_id] = (by[r.auction_user_id] ?? 0) + Number(r.total_score);
  return JSON.stringify(Object.entries(by).sort());
}

const backup = {
  taken_at: new Date().toISOString(),
  player_scores_gw1_3: await all("Player_Scores", (q) => q.in("game_week_id", [1, 2, 3])),
  gameweek_squads_a9_gw1_3: await all("gameweek_squads", (q) => q.eq("auction_id", EPL_AUCTION).in("game_week_id", [1, 2, 3])),
  auction_leaderboard_a9: await all("auction_leaderboard", (q) => q.eq("auction_id", EPL_AUCTION)),
  game_weeks: await all("Game_Weeks", (q) => q),
  competition_round_101: await all("competition_rounds", (q) => q.eq("id", 101)),
};
console.log(
  "Rows:",
  Object.fromEntries(Object.entries(backup).filter(([k]) => k !== "taken_at").map(([k, v]) => [k, v.length])),
);
const before = await standings();

if (DRY) {
  console.log("DRY RUN — no backup written, no changes made.");
  process.exit(0);
}

fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(backupDir, `pre-rekey-mw1-3-${backup.taken_at.replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backupPath, JSON.stringify(backup));
console.log("Backup written:", backupPath);

// 1) New Game_Weeks rows 100–102 (Is_Active false; global active flag untouched).
must(
  await sb.from("Game_Weeks").insert(Object.entries(EPL_NAMES).map(([id, name]) => ({ id: Number(id), GW_Name: name, Is_Active: false }))),
  "Game_Weeks insert",
);
// 2) Move rows.
for (const [from, to] of Object.entries(MAP)) {
  must(await sb.from("Player_Scores").update({ game_week_id: to }).eq("game_week_id", Number(from)), `Player_Scores ${from}`);
  must(
    await sb.from("gameweek_squads").update({ game_week_id: to }).eq("auction_id", EPL_AUCTION).eq("game_week_id", Number(from)),
    `gameweek_squads ${from}`,
  );
  must(
    await sb.from("auction_leaderboard").update({ game_week_id: to }).eq("auction_id", EPL_AUCTION).eq("game_week_id", Number(from)),
    `auction_leaderboard ${from}`,
  );
}
must(await sb.from("competition_rounds").update({ legacy_game_week_id: 100 }).eq("id", 101), "competition_rounds 101");
// 3) Give 1–3 their World Cup names back.
for (const [id, name] of Object.entries(WC_NAMES)) {
  must(await sb.from("Game_Weeks").update({ GW_Name: name }).eq("id", Number(id)), `Game_Weeks ${id}`);
}

const after = await standings();
const count = async (t, q) => (await q(sb.from(t).select("*", { count: "exact", head: true }))).count;
console.log("Player_Scores GW1–3 now:", await count("Player_Scores", (q) => q.in("game_week_id", [1, 2, 3])));
console.log("Player_Scores GW100–102 now:", await count("Player_Scores", (q) => q.in("game_week_id", [100, 101, 102])));
console.log("Auction 9 squads GW100–102:", await count("gameweek_squads", (q) => q.eq("auction_id", 9).in("game_week_id", [100, 101, 102])));
console.log("Auction 9 standings unchanged:", before === after);
