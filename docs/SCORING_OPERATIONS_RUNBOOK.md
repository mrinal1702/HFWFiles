# Scoring Operations Runbook

This runbook formalizes two operational procedures for your current admin workflow.

**World Cup 2026 agent workflow** (archived with tournament records): see [`archive/world-cup-2026/docs/AGENT_SCORES_AND_LEADERBOARD_WORKFLOW.md`](../archive/world-cup-2026/docs/AGENT_SCORES_AND_LEADERBOARD_WORKFLOW.md).

**Canonical online-auction scoring ops (all competitions):** [`auction-app/docs/OPS_SCORING_AND_LEADERBOARD.md`](../auction-app/docs/OPS_SCORING_AND_LEADERBOARD.md) via [`OPS_INDEX.md`](../auction-app/docs/OPS_INDEX.md).

**Player pool (auction prep):** Building the FotMob-based master list from squad URLs through `master_player_list.csv` is documented in [`AUCTION_PREPARATION_PROCEDURE.md`](./AUCTION_PREPARATION_PROCEDURE.md) (configure teams, scrape, role map, names, CSV).

## Procedure 1: Build Gameweek Scores CSV

**Name:** `Build Gameweek Scores CSV`  
**Script:** `C:\Users\trive\HFWFiles\procedures\generate_gameweek_scores.py`

### Purpose
- Read raw match JSON files for one real-world round.
- Run stat + endowed + keeper scoring using existing project scoring logic.
- Produce one consolidated CSV for upload.

### Input
- Match folder path (contains all match JSON files for the round), e.g.  
  `C:\Users\trive\HFWFiles\Matches_Raw\CL_RO16_Leg2`
- Gameweek ID (`gw_id`) you want in the output rows.

### Output
- CSV with columns:
  - `player_id`
  - `player_name`
  - `team_id`
  - `team_name`
  - `score` (rounded to nearest whole number)
  - `gw_id`
- Default output path:
  - `C:\Users\trive\HFWFiles\Scores\GW<gw_id>_scores.csv`

### Row types in the GW CSV
- **Outfield:** one row per player who appears in match stats; `player_id` = FotMob player id; `score` = stat points + endowed points.
- **Goalkeeper unit:** one row **per team** (two per match):
  - `player_name` = `"<TeamName> Keepers"` (e.g. `Arsenal Keepers`)
  - `player_id` = **`team_id`** (FotMob club id — not an individual GK id)
  - `score` = best-stat GK's stat points + team endowment (`18 − 6 × goals conceded`, with single-GK `<45` min rule)

Ensure club-level keeper placeholder rows exist in `players` for each `team_id` used, or review the missing-player report after publish.

### Scoring path used
`generate_gameweek_scores.py` uses the **GW rollup** path (inline `stat + endowed` merge), not `point_simulator.simulate_points()`. Per-match audit files with full breakdown use `point_simulator.py` + `presentation_final_points.py` instead. See [`MAIN_PIPELINE_FUNCTIONS.md`](./MAIN_PIPELINE_FUNCTIONS.md) § Scoring paths and § Goalkeeper representation.

**Role weights and changelog:** [`STAT_COLLECTION_AND_WORKFLOW.md`](./STAT_COLLECTION_AND_WORKFLOW.md) (penalties won +5, forward aerial duels lost 0, etc.).

### Command
```bash
python "C:\Users\trive\HFWFiles\procedures\generate_gameweek_scores.py" --matches-dir "C:\Users\trive\HFWFiles\Matches_Raw\CL_RO16_Leg2" --gw-id 1 --output "C:\Users\trive\HFWFiles\Scores\GW1_scores.csv"
```

### Fetch a single match from FotMob (scrape + score)

**Script:** `C:\Users\trive\HFWFiles\Tests\fetch_fotmob_match.py`

Use when you have a FotMob match URL and need raw JSON plus score CSVs in one step:

```bash
python "C:\Users\trive\HFWFiles\Tests\fetch_fotmob_match.py" ^
  "https://www.fotmob.com/en-GB/matches/canada-vs-bosnia-herzegovina/23f1qo#4667757:tab=stats" ^
  --score
```

**What it does**
1. Resolves `matchId` from the URL hash (e.g. `#4667757`).
2. Downloads match JSON from FotMob `api/data/matchDetails`.
3. Saves `Matches_Raw/<folder>/<Home>_Vs_<Away>.json` and a `.manifest.json` with **visual links** (stats/lineup tabs — browser only).
4. With `--score`: writes `*_Points.csv`, `*_KeeperPoints.csv`, `*_FinalPoints.csv` and copies FinalPoints to `auction-app/data/match-scores/`.

Visual links in the manifest are for viewing on [FotMob](https://www.fotmob.com); scoring always uses the saved JSON file.

### Intervention points
- You create/populate the raw match JSON folder.
- You choose `gw_id`.
- You quickly check CSV sanity after generation.

---

## Procedure 2: Publish Scores To Active Gameweek

**Name:** `Publish Scores To Active Gameweek`  
**Script:** `C:\Users\trive\HFWFiles\auction-app\scripts\publish-active-gameweek-scores.mjs`  
**NPM command:** `npm run procedure:publish-active-gw -- "<csv-path>"`

### Purpose
- Read the generated scores CSV.
- Detect the currently active gameweek in Supabase (`Game_Weeks` / `game_weeks`, `Is_Active` / `is_active`).
- Upload rows into `Player_Scores` / `player_scores` with the active gameweek id.

### Behavior
- Requires exactly one active gameweek row in DB.
- Uses active gameweek id from DB (not CSV) for upload.
- Rerun-safe: deletes existing rows for the active gameweek, then inserts new rows.
- Prints missing `player_id`s that are not found in `players`.

### Command
```bash
cd "C:\Users\trive\HFWFiles\auction-app"
npm run procedure:publish-active-gw -- "C:\Users\trive\HFWFiles\Scores\GW1_scores.csv"
```

### Intervention points
- In Supabase, ensure exactly one active gameweek (`Is_Active = true`).
- Review missing player IDs report and decide whether to add placeholders to `players`.

---

## Minimal Weekly Operating Sequence

1. Put all round match JSON files in a folder under `Matches_Raw`.
2. Run `Build Gameweek Scores CSV`.
3. Set one active gameweek row in Supabase.
4. Run `Publish Scores To Active Gameweek`.
5. Review missing-player report.

---

## Player pool: FotMob squad scrape + `master_player_list.csv`

Full step-by-step procedure (team configuration, scrape, position map, UTF-8 names):  
[`AUCTION_PREPARATION_PROCEDURE.md`](./AUCTION_PREPARATION_PROCEDURE.md)

**Squad scrape (canonical name + primary position):**  
`C:\Users\trive\HFWFiles\Tests\fetch_fotmob_squads.py`

- Loads each team’s squad page, then loads **each player’s profile page** to read:
  - `data.name` from embedded `__NEXT_DATA__` (display name)
  - primary position from `positionDescription` (short code when available, e.g. `AM`, `RB`)
- **Rate limits:** ~0.5s between player profile requests; ~1–2s pause after each club before the next squad fetch.
- Writes: `C:\Users\trive\HFWFiles\Player_List\Raw_Files\*_Squad.json`

**Master player CSV:**  
`C:\Users\trive\HFWFiles\Tests\build_master_player_csv.py` → `C:\Users\trive\HFWFiles\Player_List\master_player_list.csv`  
The script maps each row’s `position` to fantasy roles (`Defender`, `Midfielder`, `Forward`, `Goalkeeper`) before save; squad JSON files keep raw codes. The CSV is written as **UTF-8 with BOM** so Excel on Windows opens accented names correctly (e.g. Aurélien Tchouaméni). If you still see mojibake like `AurÃ©lien`, use **Data → Get Data → From Text/CSV** and set encoding to UTF-8, or re-open after regenerating the file.

```bash
python "C:\Users\trive\HFWFiles\Tests\fetch_fotmob_squads.py"
python "C:\Users\trive\HFWFiles\Tests\build_master_player_csv.py"
```

**Supabase upload alias:** `npm run upload:scores` runs `publish-active-gameweek-scores.mjs` (pass CSV path as the first argument).

---

## Relevant Paths

- Raw matches root: `C:\Users\trive\HFWFiles\Matches_Raw`
- Scores output root: `C:\Users\trive\HFWFiles\Scores`
- Player list CSV: `C:\Users\trive\HFWFiles\Player_List\master_player_list.csv`
- Squad JSON folder: `C:\Users\trive\HFWFiles\Player_List\Raw_Files`
- Procedure 1 script: `C:\Users\trive\HFWFiles\procedures\generate_gameweek_scores.py`
- Round pipeline (per-match + GW CSV): `C:\Users\trive\HFWFiles\scripts\run_round_pipeline.py`
- Procedure 2 script: `C:\Users\trive\HFWFiles\auction-app\scripts\publish-active-gameweek-scores.mjs`
- Position overrides (in-match scoring): `C:\Users\trive\HFWFiles\Tests\position_roles.py`
- Pipeline reference: `C:\Users\trive\HFWFiles\docs\MAIN_PIPELINE_FUNCTIONS.md`
- Stat / workflow reference: `C:\Users\trive\HFWFiles\docs\STAT_COLLECTION_AND_WORKFLOW.md`
- Scoring modules: `C:\Users\trive\HFWFiles\scoring`
- Calculators: `C:\Users\trive\HFWFiles\Tests`
- GW1 batch rescore: `C:\Users\trive\HFWFiles\scripts\rescore_finalpoints.py`
- FinalPoints validation: `C:\Users\trive\HFWFiles\Tests\validate_final_points.py`
- Agent incident reference: `C:\Users\trive\HFWFiles\docs\AGENT_SCORING_LESSONS_GW1_RESCORE.md`
- Best XI compute / publish: `procedures/compute_auction_best_xi.py`, `auction-app/scripts/publish-best-xi-from-json.mjs`

---

## Rollback: GW1 points (one-step revert)

Git tags mark the last known-good GW1 publish **before** and **after** the LM/RM + `positionId` 85 position-map rescore (18 Jun 2026).

| Tag | Meaning |
|-----|---------|
| `points/gw1-pre-rescore` | FinalPoints, Best XI JSON, and overlays **before** the rescore |
| `points/gw1-rescore-position-map` | Rescored GW1 points with updated position map |

### Restore old points in git + on Vercel

```bash
cd C:\Users\trive\HFWFiles
git checkout points/gw1-pre-rescore -- "Matches_Raw/World Cup 2026" Scores/best_xi_auction_*_gw1.json auction-app/data/match-scores auction-app/data/best-xi
git commit -m "Revert GW1 points to pre-rescore snapshot."
git push origin main
```

Redeploy on Vercel happens automatically from `main`. Then republish Supabase from the restored files:

```bash
cd auction-app
# All 24 GW1 FinalPoints (PowerShell)
$files = Get-ChildItem "..\Matches_Raw\World Cup 2026\*_FinalPoints.csv" | % { $_.FullName }
node scripts/upsert-player-scores-from-finalpoints.mjs 1 @files
npm run publish:best-xi -- --auction-id 5 --gw-id 1
npm run publish:best-xi -- --auction-id 6 --gw-id 1
npm run publish:best-xi -- --auction-id 7 --gw-id 1
```

To go forward again after a rollback, check out `points/gw1-rescore-position-map` the same way and repeat upsert + publish.
