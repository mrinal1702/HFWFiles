# Main Pipeline Functions

This document describes only the core files, their purpose, and outputs.

**Auction player pool (squad scrape → master CSV):** see [`AUCTION_PREPARATION_PROCEDURE.md`](./AUCTION_PREPARATION_PROCEDURE.md).

## 0) FotMob squad scrape + master player list

### Files
- `Tests/fetch_fotmob_squads.py` — fetches each configured team squad page, then each player profile for **canonical `data.name`** and **primary position** (`positionDescription` in `__NEXT_DATA__`). Writes `Player_List/Raw_Files/*_Squad.json`. Rate limits: ~0.5s between player profile requests, ~1–2s between clubs.
- `Tests/fotmob_player_profile.py` — shared helpers for profile HTML / JSON parsing.
- `Tests/build_master_player_csv.py` — merges squad JSONs into `Player_List/master_player_list.csv` (one row per `player_id`; **single** `position` from the best row). **Before writing the CSV**, it maps raw FotMob codes to fantasy roles (`Defender`, `Midfielder`, `Forward`, `Goalkeeper`); **LW** and **RW** map to **Forward**. Rows with empty `position`, **Coach**, or an unknown code are omitted from the export.

### Output
- `Player_List/Raw_Files/<Team>_Squad.json`
- `Player_List/master_player_list.csv` (column `position` = mapped role, not raw FotMob code)

## 1) Statistic Collection

### File
`Tests/stat_collection.py`

### Purpose
Reads one match JSON and produces per-player outfield stats (defenders, midfielders, forwards).

### Main logic
- Reads:
  - `content.playerStats`
  - `content.lineup` (for `usualPlayingPositionId`)
  - `content.matchFacts.events.events` (for red cards and own goals)
- Excludes goalkeepers.
- Derives extra fields such as:
  - `inaccurate_passes`
  - `ground_duels_lost`
  - `aerial_duels_lost`
  - `dribbles_failed`
  - `clearances_total`
- Captures match-dependent keys when present, defaulting to `0` when absent:
  - `missed_penalty`
  - `woodwork`
  - `last_man_tackle`
  - `clearance_off_the_line`

### Output files
- `Tests/stat_collection_defenders.csv`
- `Tests/stat_collection_midfielders.csv`
- `Tests/stat_collection_forwards.csv`


## 2) Role Scoring Configs

### Files
- `scoring/defender_points.py`
- `scoring/midfielder_points.py`
- `scoring/forward_points.py`

### Purpose
Define weights + formula terms for each role.

### Structure
Each role file provides:
- `<ROLE>_WEIGHTS`
- `<ROLE>_FORMULAS`
- `<ROLE>_STAT_KEYS`
- `<ROLE>_SCORING`

Formulas include:
- minutes term (`minutes_per_point`)
- dispossessed term (`dispossessed_base` and `dispossessed_per_event`)

### Export
`scoring/__init__.py` exports:
- `DEFENDER_SCORING`
- `MIDFIELDER_SCORING`
- `FORWARDS_SCORING`


## 3) Stat Points Calculator

### File
`Tests/Calculate_stat_points.py`

### Purpose
Applies role scoring configs to stat-collection output and calculates stat-only points.

### Output columns (core)
- `stat_points_weighted`
- `stat_points_dispossessed_formula`
- `stat_points_minutes`
- `stat_points_total`


## 4) Endowed Points Calculator

### Files
- `Tests/endowed_points.py`
- `Tests/calculate_endowed_points.py`

### Purpose
Derives on-field intervals and computes endowed points from match state while player is on pitch.

### Main logic
- Builds on/off intervals from lineup + substitution events.
- Counts goals for and goals against while each player is on field.
- Applies role endowed rules (+ halving logic under 45 minutes).

### Output columns (core)
- `minutes_played_derived`
- `goals_for_while_on_field`
- `goals_against_while_on_field`
- `endowed_points`


## 5) Full Match Point Simulator

### File
`Tests/point_simulator.py`

### Purpose
Combines:
- stat points (`Calculate_stat_points.py`)
- endowed points (`calculate_endowed_points.py`)

### Final output
- `total_points = stat_points_total + endowed_points`
- One CSV per match in `Tests/` named:
  - `<HomeTeamNoSpaces>_<AwayTeamNoSpaces>_Points.csv`
  - Example: `Barcelona_NewcastleUnited_Points.csv`


## 6) Typical Run Order

1. `stat_collection.py`
2. `Calculate_stat_points.py`
3. `calculate_endowed_points.py`
4. `point_simulator.py` (or run directly to execute full pipeline)

