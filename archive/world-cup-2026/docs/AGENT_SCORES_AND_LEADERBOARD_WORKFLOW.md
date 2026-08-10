# Agent workflow: match scores, public page, leaderboards

**Audience:** Cursor agent (or operator) handling World Cup 2026 **per-match scoring**, **public scores tabs**, **player breakdowns**, and **Supabase leaderboard uploads**.

**Repo root:** `C:\Users\trive\HFWFiles`  
**Live app:** https://hfwauction.vercel.app

**Related docs (deeper reference, not required for every match):**
- [`POSITION_MAP_POLICY.md`](./POSITION_MAP_POLICY.md) — **GW1 frozen; GW2+ topPlayers map**
- [`MAIN_PIPELINE_FUNCTIONS.md`](./MAIN_PIPELINE_FUNCTIONS.md) — scoring pipeline internals
- [`STAT_COLLECTION_AND_WORKFLOW.md`](./STAT_COLLECTION_AND_WORKFLOW.md) — stat keys and derived fields
- [`SCORING_OPERATIONS_RUNBOOK.md`](./SCORING_OPERATIONS_RUNBOOK.md) — older CL-style GW CSV path (`generate_gameweek_scores.py`)

---

## What this workflow covers

| Task | Outcome |
|------|---------|
| **1. Calculate scores** | FotMob URL → JSON + `*FinalPoints.csv` in `Matches_Raw/` |
| **2. Public scores page** | New tab on https://hfwauction.vercel.app/scores |
| **3. Player breakdown** | Explain stats + endowment for one player (on request) |
| **4. Leaderboard upload** | Upsert rows into Supabase `Player_Scores` for the active GW |

---

## Hard rules (do not break production)

1. **Do NOT** run `npm run import:players` / `import-master-player-list.mjs` — it **wipes** the player pool.
2. **Do NOT** regenerate `Player_List/master_player_list.csv` unless explicitly asked.
3. **Do NOT** use `npm run procedure:publish-active-gw` for World Cup uploads — it does **not** remap keeper units correctly. Use **`npm run upsert:player-scores`** instead (see Task 4).
4. **Do NOT** amend past gameweek scores in Supabase unless the commissioner explicitly asks to re-publish a GW.
5. **GW1 group-stage scores are FROZEN** — do not batch-rescore `Matches_Raw/World Cup 2026` or re-upsert all GW1 FinalPoints. The expanded topPlayers map in `position_roles.py` applies from **GW2+** only. See [`POSITION_MAP_POLICY.md`](./POSITION_MAP_POLICY.md).
6. Late call-ups: add rows manually + `scripts/add-players-to-pool.mjs` — not covered here unless requested.

**Credentials:** `auction-app/.env.local` must contain `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for Supabase scripts.

**Shell (Windows):** use `;` to chain commands in PowerShell; avoid bash heredocs for `git commit`.

---

## Key paths and code map

### Scoring (Python) — repo root

| Path | Role |
|------|------|
| `Tests/fetch_fotmob_match.py` | **Primary entry:** fetch JSON + optional `--score` |
| `Tests/stat_collection.py` | Extract per-player stats from JSON |
| `Tests/Calculate_stat_points.py` | Apply role weights → stat points |
| `Tests/endowed_points.py` | Team-context endowment (minutes, goals while on) |
| `Tests/calculate_keeper_points.py` | Keeper unit stat points |
| `Tests/point_simulator.py` | Writes `*_Points.csv` (outfield breakdown) |
| `Tests/final_points.py` | **Shared FinalPoints merge + validation** (all paths must use this) |
| `Tests/validate_final_points.py` | CLI: validate `*_FinalPoints.csv` before upload |
| `scripts/rescore_finalpoints.py` | Batch-regenerate FinalPoints from a match JSON folder |
| `scoring/defender_points.py` | Defender weights |
| `scoring/midfielder_points.py` | Midfielder weights |
| `scoring/forward_points.py` | Forward weights (`aerial_duels_lost: 0`; `penalties_won: 5` since 2026-06) |
| `Tests/position_roles.py` | In-match role overrides — **GW2+ complete topPlayers map** (GW1 frozen) |

### Match outputs — World Cup 2026 folder

| Path | Role |
|------|------|
| `Matches_Raw/World Cup 2026/<Home>_Vs_<Away>.json` | Raw FotMob payload (source of truth for scoring) |
| `Matches_Raw/World Cup 2026/<Home>_Vs_<Away>.manifest.json` | FotMob visual links + `match_id` |
| `Matches_Raw/World Cup 2026/<Home>_<Away>_Points.csv` | Outfield stat breakdown |
| `Matches_Raw/World Cup 2026/<Home>_<Away>_KeeperPoints.csv` | Keeper units |
| `Matches_Raw/World Cup 2026/<Home>_<Away>_FinalPoints.csv` | **Upload + public page source** |
| `Scores/WC2026_GW1_scores.csv` | Optional consolidated archive (not used for Supabase upload) |

**Naming note:** JSON uses `_Vs_` (e.g. `USA_Vs_Paraguay.json`); CSVs use single underscore between teams (e.g. `USA_Paraguay_FinalPoints.csv`). Team slugs drop spaces/punctuation (`BosniaandHerzegovina`).

### Public scores app — `auction-app/`

| Path | Role |
|------|------|
| `data/match-scores/<Match>_FinalPoints.csv` | CSV read at build time for the scores page |
| `lib/match-scores/sheets.ts` | **Register tabs** (`MATCH_SCORE_SHEETS`) |
| `lib/match-scores/parse-final-points.ts` | Parses FinalPoints CSV |
| `app/scores/page.tsx` | Main page: `/scores?match=<slug>` |
| `app/scores/<slug>/page.tsx` | Optional redirect → `?match=<slug>` |
| `app/scores/_components/ScoresTabs.tsx` | Tab UI |

### Leaderboard — Supabase + app

| Path / table | Role |
|--------------|------|
| `scripts/upsert-player-scores-from-finalpoints.mjs` | **Upload script** (keeper remap `90_000_000 + team_id`) |
| `scripts/lib/keeper-player-id.mjs` | Keeper unit ID rules |
| `scripts/sql/player-scores.sql` | `Player_Scores` table + `upsert_player_scores` RPC |
| `public."Player_Scores"` | DB table: `player_id`, `game_week_id`, `"Score"` |
| `public.player_scores` | View used by the app (`score` column) |
| `public.gameweek_squads` | Locked GW1 squads (per auction) |
| `public."Game_Weeks"` | `id`, `GW_Name`, `Is_Active` |
| `lib/leaderboard-data.ts` | Joins squads + `Player_Scores` on **This Gameweek** tab |

**Leaderboard URLs (auctions 5, 6, 7):**
- https://hfwauction.vercel.app/leaderboard/5
- https://hfwauction.vercel.app/leaderboard/6
- https://hfwauction.vercel.app/leaderboard/7

Open **This Gameweek** → per-player points appear when `Player_Scores` has that `player_id` for the active GW. Manager **totals** stay blank until Best XI / `auction_leaderboard` is populated.

---

## Published matches reference (GW1 World Cup 2026)

Use as templates when adding match #5, #6, …

| Slug | Public URL | FinalPoints file | FotMob stats tab |
|------|------------|------------------|------------------|
| `mexico-south-africa` | `/scores?match=mexico-south-africa` | `Mexico_SouthAfrica_FinalPoints.csv` | (see manifest in `Matches_Raw/`) |
| `south-korea-czechia` | `/scores?match=south-korea-czechia` | `SouthKorea_Czechia_FinalPoints.csv` | (see manifest) |
| `canada-bosnia-herzegovina` | `/scores?match=canada-bosnia-herzegovina` | `Canada_BosniaandHerzegovina_FinalPoints.csv` | https://www.fotmob.com/en-GB/matches/canada-vs-bosnia-herzegovina/23f1qo#4667757:tab=stats |
| `usa-paraguay` | `/scores?match=usa-paraguay` | `USA_Paraguay_FinalPoints.csv` | https://www.fotmob.com/en-GB/matches/usa-vs-paraguay/1hr85j#4667771:tab=stats |

**Main scores hub:** https://hfwauction.vercel.app/scores

**Active gameweek (GW3):** `game_week_id = 3`, name `FIFA World Cup Group Stage GW3`, `Is_Active = true` in `Game_Weeks`. Lock squads with `scripts/sql/auction-gw3-lock-all.sql` (or `setup-auction-gw-state.mjs --lock-gw 3` per auction) after the GW3 hard deadline.

---

## Task 1 — Calculate scores from a FotMob URL

**When:** Match finished; commissioner provides a FotMob stats URL (hash contains `matchId`, e.g. `#4667771:tab=stats`).

**Command** (from repo root):

```powershell
cd C:\Users\trive\HFWFiles
python Tests/fetch_fotmob_match.py "https://www.fotmob.com/en-GB/matches/usa-vs-paraguay/1hr85j#4667771:tab=stats" --score
```

**Defaults:**
- JSON + CSVs → `Matches_Raw/World Cup 2026/`
- `--score` also copies FinalPoints → `auction-app/data/match-scores/`

**Verify:**
- Top scorers printed to console
- `*_FinalPoints.csv` exists in both folders above
- `.manifest.json` saved with visual links

**Optional:** refresh archive CSV after several matches:

```powershell
cd C:\Users\trive\HFWFiles\auction-app
node scripts/build-wc-gw1-scores-csv.mjs
```

---

## Task 2 — Add match to the public scores page

**When:** Task 1 complete; commissioner wants the match on the live scores hub.

### Step 2a — Ensure CSV is in app data

`fetch_fotmob_match.py --score` should already copy to:

`auction-app/data/match-scores/<Home>_<Away>_FinalPoints.csv`

If missing, copy manually from `Matches_Raw/World Cup 2026/`.

### Step 2b — Register tab in `sheets.ts`

File: `auction-app/lib/match-scores/sheets.ts`

Add an entry to `MATCH_SCORE_SHEETS`:

```typescript
{
  slug: "usa-paraguay",                    // kebab-case URL slug
  title: "USA vs Paraguay",              // tab label
  subtitle: "World Cup 2026 · Group stage",
  rows: loadMatchScoreCsv("USA_Paraguay_FinalPoints.csv"),
},
```

### Step 2c — Optional redirect route

Create `auction-app/app/scores/<slug>/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default function UsaParaguayRedirect() {
  redirect("/scores?match=usa-paraguay");
}
```

### Step 2d — Deploy (Vercel)

Commit **only** scores-related app files, push to `main` (auto-deploy):

```powershell
cd C:\Users\trive\HFWFiles
git add auction-app/lib/match-scores/sheets.ts `
        auction-app/app/scores/<slug>/page.tsx `
        auction-app/data/match-scores/<Match>_FinalPoints.csv
git commit -m "Add public scores page for <Home> vs <Away>." -m "Publish GW1 match scores on the scores tab."
git push origin main
```

**Live check:** https://hfwauction.vercel.app/scores?match=<slug>

The public page shows **final score only** (player, team, position, rounded `final_score`). It does not show stats/endowment breakdown.

---

## Task 3 — Player score breakdown (on request)

**When:** Commissioner or participant asks why player X scored Y (e.g. “Balogun scored 2 goals but only 42 points”).

### Final score formula

```
final_score = round(max(0, stat_points_total + endowed_points))
```

Columns in `*_FinalPoints.csv`:

| Column | Meaning |
|--------|---------|
| `stats_score` | `stat_points_total` from pipeline |
| `endowment_score` | Team-context endowment |
| `final_score` | Rounded integer shown in app |

### Stat points (`*_Points.csv` columns)

| Column | Meaning |
|--------|---------|
| `stat_points_weighted` | Sum of (stat × weight) from `scoring/*_points.py` |
| `stat_points_dispossessed_formula` | Role-specific dispossessed bonus |
| `stat_points_minutes` | `minutes_played / 30` (role-specific) |
| `stat_points_total` | Sum of the three above |
| `goals_for_while_on_field` | Team goals while player on pitch (for endowment) |
| `endowed_points` | From `endowed_points.py` rules |
| `total_points` | Raw total before FinalPoints rounding |

### Endowment rules (summary)

| Role | Base (45+ mins) | Base (<45 mins) | While on pitch |
|------|-----------------|-----------------|----------------|
| Defender | +10 | +5 | −5 per goal conceded |
| Midfielder | +5 | +2.5 | +2 per team goal, −2 per conceded |
| Forward | 0 | 0 | **+3 per team goal** (not per personal goal) |

Forwards: two personal goals still help via **stat** weight `goals × 10`, but endowment uses **team goals while on**, capped by how many the team scored during their minutes.

### How to produce a breakdown

1. Read `Matches_Raw/World Cup 2026/<Match>_Points.csv` for the player row.
2. Read raw stats from JSON or re-run stat collection:

```powershell
cd C:\Users\trive\HFWFiles\Tests
python stat_collection.py "../Matches_Raw/World Cup 2026/USA_Vs_Paraguay.json"
```

3. Map stats to weights using the player’s **scoring role** (`defender` / `midfielder` / `forward`) from `Calculate_stat_points.py` output — check `role` column in `*_Points.csv`.
4. Explain positives (goals, shots on target, passes) and negatives (`tackles_lost` / beaten by dribble, `dribbles_failed`, offsides, etc.).

**Clearances vs headed clearances (FotMob semantics — explanation only):**

FotMob’s `headed_clearance` is a **subset** of `clearances`, not an extra count. Example: `clearances = 8`, `headed_clearance = 5` means **8 clearances total**, 5 of which were headed — **not** 13 clearances.

**Scoring is unchanged:** the pipeline still uses `clearances_total = clearances + headed_clearance` (same points as today).

When **explaining** breakdowns to users, describe it as headed clearances earning **double** the clearance rate (1.1 per foot clearance, 2.2 per headed), which is equivalent to the current formula:

`(clearances − headed_clearance) × 1.1 + headed_clearance × 2.2` = `(clearances + headed_clearance) × 1.1`

Do **not** rescore past matches for this; it is interpretation-only.

**Duels vs tackles vs take-ons (2026-06):**

| User term | FotMob | Scoring |
|-----------|--------|---------|
| Tackles lost (defender beaten) | `dribbled_past` | `tackles_lost` weight on `tackles_lost` column |
| Dribbles failed (attacker) | `dribbles_succeeded` attempts − successes | `dribbles_lost` weight on `dribbles_failed` |
| Ground duels lost | `ground_duels_won` fraction | **not scored** (column `ground_duels_lost` is audit-only) |

**Weight files:** `scoring/forward_points.py`, `scoring/midfielder_points.py`, `scoring/defender_points.py`.

**Scoring rule changelog (2026-06):** see [`STAT_COLLECTION_AND_WORKFLOW.md` § Scoring rule changelog](../docs/STAT_COLLECTION_AND_WORKFLOW.md#scoring-rule-changelog).

- **`penalties_won`:** **+5** per penalty won (all outfield roles). Collected from FotMob `penalties_won`; **not** dependent on conversion. Separate from `assists` (+8) and penalty goals (+10 via `goals`).
- **`missed_penalty`:** **−5** (taker who missed).
- **Forward `aerial_duels_lost`:** weight **0** (matches scored after 2026-06 only).
- **`tackles_lost`:** FotMob **`dribbled_past`** → `tackles_lost` column; **not** ground duels lost. No separate `dribbled_past` weight.
- **`dribbles_failed`:** failed take-ons → `dribbles_lost` weight.

---

## Task 4 — Push scores to Supabase (leaderboards)

**When:** Task 1 complete; participants should see per-player points on **This Gameweek** for locked squads.

**Script:** `auction-app/scripts/upsert-player-scores-from-finalpoints.mjs`  
**NPM:** `npm run upsert:player-scores`

**Behavior:**
- Upserts into `public."Player_Scores"` for the given `game_week_id`
- **Merges** — pass one new CSV or **all** completed match CSVs for that GW
- Remaps keeper rows: `team_id` → `90_000_000 + team_id` (e.g. USA `6713` → `90006713`)
- Warns if `player_id` not in `public.players` (unused sub / late call-up not in pool)

**Command** — after a GW3 match finishes:

```powershell
cd C:\Users\trive\HFWFiles\auction-app
npm run upsert:player-scores -- 3 "../Matches_Raw/World Cup 2026/<Home>_<Away>_FinalPoints.csv"
```

**GW1 example** (frozen — do not re-upsert unless commissioner asks):

```powershell
cd C:\Users\trive\HFWFiles\auction-app
npm run upsert:player-scores -- 1 `
  "../Matches_Raw/World Cup 2026/Mexico_SouthAfrica_FinalPoints.csv" `
  "../Matches_Raw/World Cup 2026/SouthKorea_Czechia_FinalPoints.csv" `
  "../Matches_Raw/World Cup 2026/Canada_BosniaandHerzegovina_FinalPoints.csv" `
  "../Matches_Raw/World Cup 2026/USA_Paraguay_FinalPoints.csv"
```

**After a single new match**, you may pass only the new FinalPoints file — upsert is incremental. Passing **all** files for the GW is safer and idempotent.

**Verify:**
- Console: `Upserted N rows into Player_Scores`
- Leaderboard **This Gameweek**: owned players from that match show points (not `—`)
- Supabase: `select count(*) from "Player_Scores" where game_week_id = 1;`

**No git deploy required** for Task 4 — Supabase updates are live immediately.

---

## End-to-end checklist (new finished match)

Copy for the agent each time:

```
[ ] 1. fetch_fotmob_match.py "<url>" --score
[ ] 2. python Tests/validate_final_points.py "<path/to/Match_FinalPoints.csv>"
[ ] 3. Sanity-check keeper rows: stats_score + endowment_score → final_score (not 0)
[ ] 4. Add tab in auction-app/lib/match-scores/sheets.ts
[ ] 5. Ensure data/match-scores/<Match>_FinalPoints.csv present
[ ] 6. (Optional) app/scores/<slug>/page.tsx redirect
[ ] 7. git commit + push main → Vercel scores page
[ ] 8. npm run upsert:player-scores -- <gw_id> <all FinalPoints for GW>  (auto-validates keepers)
[ ] 9. compute_auction_best_xi.py + publish:best-xi per auction (if GW squads locked)
[ ] 10. Confirm leaderboard/5|6|7 — keeper line not 0, totals sensible
[ ] 11. Send commissioner: scores URL + leaderboard URLs
```

**Example commissioner message:**

> Scores live: https://hfwauction.vercel.app/scores?match=usa-paraguay  
> Leaderboards updated for GW1: https://hfwauction.vercel.app/leaderboard/5

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| **All keepers show 0** on leaderboard | FinalPoints keeper `final_score` not computed | Run `python Tests/validate_final_points.py`; see [`AGENT_SCORING_LESSONS_GW1_RESCORE.md`](./AGENT_SCORING_LESSONS_GW1_RESCORE.md) |
| Player shows `—` on leaderboard | Not in `Player_Scores` or wrong GW id | Run upsert; confirm `game_week_id` |
| Keeper shows `—` | Used raw `team_id` instead of `9000…` | Use `upsert:player-scores`, not `publish-active-gw` |
| Warning: player not in `players` | Unused sub / not in auction pool | Expected; ignore if zero minutes, or add via `add-players-to-pool.mjs` |
| Scores tab missing after push | `sheets.ts` or CSV not committed | Check Vercel build; verify `data/match-scores/` in repo |
| Wrong role weights | Winger override | Check `Tests/position_roles.py` + `role` in `*_Points.csv` |
| `fetch_fotmob_match` API fails | FotMob block | Script falls back to page scrape; ensure full URL with hash |

---

## Out of scope for this doc

- Best XI / formation logic / `auction_leaderboard` totals — see [`AGENT_SCORING_LESSONS_GW1_RESCORE.md`](./AGENT_SCORING_LESSONS_GW1_RESCORE.md) for publish flow
- GW2 squad lock, budget boost, bidding deadlines
- Full master player list regeneration
- Amending historical scores after commissioner sign-off

For those, see [`GAMEWEEK_FLOW.md`](../auction-app/docs/GAMEWEEK_FLOW.md) and [`MAIN_PIPELINE_FUNCTIONS.md`](./MAIN_PIPELINE_FUNCTIONS.md).
