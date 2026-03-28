# Scoring Operations Runbook

This runbook formalizes two operational procedures for your current admin workflow.

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

### Command
```bash
python "C:\Users\trive\HFWFiles\procedures\generate_gameweek_scores.py" --matches-dir "C:\Users\trive\HFWFiles\Matches_Raw\CL_RO16_Leg2" --gw-id 1 --output "C:\Users\trive\HFWFiles\Scores\GW1_scores.csv"
```

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
- Procedure 2 script: `C:\Users\trive\HFWFiles\auction-app\scripts\publish-active-gameweek-scores.mjs`
- Existing scoring modules: `C:\Users\trive\HFWFiles\scoring`
- Existing calculators: `C:\Users\trive\HFWFiles\Tests`
