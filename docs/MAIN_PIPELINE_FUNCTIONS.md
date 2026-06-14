# Main Pipeline Functions

This document describes the core scoring pipeline: stat extraction, point calculation, output paths, and how goalkeeper units are represented in gameweek CSVs.

**Auction player pool (squad scrape → master CSV):** see [`AUCTION_PREPARATION_PROCEDURE.md`](./AUCTION_PREPARATION_PROCEDURE.md).

**Operational runbook (build GW CSV → publish to Supabase):** see [`SCORING_OPERATIONS_RUNBOOK.md`](./SCORING_OPERATIONS_RUNBOOK.md).

**Agent handoff (WC match scoring, public scores page, leaderboard upload, breakdowns):** see [`AGENT_SCORES_AND_LEADERBOARD_WORKFLOW.md`](./AGENT_SCORES_AND_LEADERBOARD_WORKFLOW.md).

## 0) FotMob squad scrape + master player list

### Files
- `Tests/fetch_fotmob_squads.py` — fetches each configured team squad page, then each player profile for **canonical `data.name`** and **primary position** (`positionDescription` in `__NEXT_DATA__`). Writes `Player_List/Raw_Files/*_Squad.json`. Rate limits: ~0.5s between player profile requests, ~1–2s between clubs.
- `Tests/fotmob_player_profile.py` — shared helpers for profile HTML / JSON parsing.
- `Tests/build_master_player_csv.py` — merges squad JSONs into `Player_List/master_player_list.csv` (one row per `player_id`; **single** `position` from the best row). **Before writing the CSV**, it maps raw FotMob codes to fantasy roles (`Defender`, `Midfielder`, `Forward`, `Goalkeeper`); **LW** and **RW** map to **Forward**. Rows with empty `position`, **Coach**, or an unknown code are omitted from the export.

### Output
- `Player_List/Raw_Files/<Team>_Squad.json`
- `Player_List/master_player_list.csv` (column `position` = mapped role, not raw FotMob code)

> **Note:** Master-list position mapping (auction pool) is separate from **in-match role resolution** used for scoring — see [Position overrides](#1a-position-overrides-in-match-scoring) below.

---

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
  - `Tests/position_roles.py` (for winger/striker overrides — see below)
- Excludes goalkeepers.
- Derives extra fields such as:
  - `inaccurate_passes`
  - `ground_duels_lost` (exported; **not** mapped to `tackles_lost`)
  - `aerial_duels_lost`
  - `dribbles_failed` (failed take-ons)
  - `tackles_lost` (from FotMob `dribbled_past`)
  - `clearances_total`
- Captures match-dependent keys when present, defaulting to `0` when absent:
  - `penalties_won`
  - `missed_penalty`
  - `woodwork`
  - `last_man_tackle`
  - `clearance_off_the_line`

### Output files (standalone CLI)
- `Tests/stat_collection_defenders.csv`
- `Tests/stat_collection_midfielders.csv`
- `Tests/stat_collection_forwards.csv`

---

## 1a) Position overrides (in-match scoring)

### File
`Tests/position_roles.py`

### Purpose
Resolves which **scoring role** (defender / midfielder / forward) applies to each outfield player **for a specific match**. Used by `stat_collection.py`, `endowed_points.py`, and best-XI helpers.

### Base position
From `content.lineup` starters/subs: `usualPlayingPositionId` — `0` GK, `1` DEF, `2` MID, `3` FWD. Falls back to `usualPosition` on the player blob if missing from lineup.

### Overrides from `matchFacts.topPlayers`
After the base lineup bucket is known, `role_override_by_player()` may change the role:

| `positionLabel.key` | Override |
|---------------------|----------|
| `striker_short` | Forward (`3`) |
| `leftwinger_short` / `rightwinger_short` | Midfielder (`2`) **only** if granular lineup `positionId` is in `WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS` |

### Granular `positionId` rule (wingers)
FotMob assigns a granular `positionId` per player in the lineup (e.g. `83` = RW, `87` = LW, `103` / `107` = other wide roles).

Currently only `{83, 87}` map LW/RW topPlayer labels to midfielder scoring (sample data: Yamal RW = 83, Raphinha LW = 87). Other wingers (e.g. Barnes `107`, Elanga `103`) **stay forward** (`usualPlayingPositionId`, typically `3`).

To extend this for new competitions, edit `WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS` in `position_roles.py`.

### Import surface
```python
from position_roles import (
    lineup_usual_position_by_player,
    role_override_by_player,
    resolve_outfield_position_id_for_scoring,
)
```

---

## 2) Role Scoring Configs

### Files
- `scoring/defender_points.py`
- `scoring/midfielder_points.py`
- `scoring/forward_points.py`
- `scoring/goalkeeper_points.py`

### Purpose
Define weights + formula terms for each role.

### Structure
Each outfield role file provides:
- `<ROLE>_WEIGHTS`
- `<ROLE>_FORMULAS`
- `<ROLE>_STAT_KEYS`
- `<ROLE>_SCORING`

Formulas include:
- minutes term (`minutes_per_point`, typically `1/30`)
- dispossessed term (`dispossessed_base` and `dispossessed_per_event`) — outfield only

See **Scoring rule changelog** in [`STAT_COLLECTION_AND_WORKFLOW.md`](./STAT_COLLECTION_AND_WORKFLOW.md#scoring-rule-changelog).

### Duels, tackles, and take-ons (all outfield roles)

| Concept | FotMob | Export column | Weight key |
|--------|--------|---------------|------------|
| Tackles won | `matchstats.headers.tackles` | `tackles` | `tackles_won` |
| Tackles lost (beaten) | `dribbled_past` | `tackles_lost` | `tackles_lost` |
| Failed take-on | `dribbles_succeeded` (attempts − successes) | `dribbles_failed` | `dribbles_lost` |
| Ground duels lost | `ground_duels_won` (total − won) | `ground_duels_lost` | not scored |

Weights per role: defender `tackles_lost` −1.6 / `dribbles_lost` −0.8; midfielder −0.6 / −0.8; forward −1.0 / −1.0. There is **no** separate `dribbled_past` weight (since 2026-06).

### Penalty-related stat weights (all outfield roles)

| Stat | FotMob key | Weight | Notes |
|------|------------|--------|-------|
| Penalties won | `penalties_won` | **+5** each | Awarded per player aggregate; **not** tied to conversion or scorer. Added 2026-06. |
| Missed penalty | `missed_penalty` | **−5** each | Taker who missed (not the player who won the foul). |
| Goals (penalty) | `goals` + timeline | **+10** | Scorer only; separate from `penalties_won`. |
| Assists | `assists` | **+8** | FotMob `assists` only; does **not** include penalty won. |

See **Scoring rule changelog** in [`STAT_COLLECTION_AND_WORKFLOW.md`](./STAT_COLLECTION_AND_WORKFLOW.md#scoring-rule-changelog).

### Role-specific notes (2026-06)

- **Forwards:** `aerial_duels_lost` weight is **0** (no bonus or penalty for lost aerials). Previously `+0.4` (typo) for GW1 matches scored before this fix.
- **Defenders / midfielders:** `aerial_duels_lost` remains negative (−0.7 / −0.8).
- **`tackles_lost`:** scored from **`dribbled_past`**, not ground duels lost (see table above). GW1 re-scored after this fix.

Goalkeeper config additionally documents endowment rules in `GOALKEEPER_ENDOWMENT_RULES` (implemented in `calculate_keeper_points.py`).

### Export
`scoring/__init__.py` exports:
- `DEFENDER_SCORING`
- `MIDFIELDER_SCORING`
- `FORWARDS_SCORING`
- `GOALKEEPER_SCORING`

---

## 3) Stat Points Calculator

### File
`Tests/Calculate_stat_points.py`

### Purpose
Applies role scoring configs to stat-collection output and calculates stat-only points.

### Main logic
- Splits players by resolved position (`1` / `2` / `3`).
- Applies the matching `*_SCORING` config per role.
- **Zeroes all stat points** when `minutes_played` is 0 (prevents dispossessed base bonus for unused subs).

### Output columns (core)
- `stat_points_weighted`
- `stat_points_dispossessed_formula`
- `stat_points_minutes`
- `stat_points_total`

---

## 4) Endowed Points Calculator

### Files
- `Tests/endowed_points.py`
- `Tests/calculate_endowed_points.py`

### Purpose
Derives on-field intervals and computes endowed points from match state while player is on pitch.

### Main logic
- Builds on/off intervals from lineup starters + `Substitution` events in the timeline.
- Counts goals for and goals against while each player is on field.
- Applies role endowed rules (halving when derived minutes `< 45`):

| Role | Base (short) | Per goal for | Per goal against |
|------|--------------|--------------|------------------|
| Defender | 10 (5) | — | −5 |
| Midfielder | 5 (2.5) | +2 | −2 |
| Forward | 0 (−2.5) | +3 | — |

- Uses the same position overrides as stat collection (`position_roles.py`).

### Output columns (core)
- `minutes_played_derived`
- `goals_for_while_on_field`
- `goals_against_while_on_field`
- `endowed_points`

---

## 5) Full Match Point Simulator (outfield)

### File
`Tests/point_simulator.py`

### Purpose
Combines stat points and endowed points for **outfield players only**.

### Merge logic (`simulate_points`)
1. Merge stat + endowed on `player_id`.
2. Fill missing endowed values with `0`.
3. **Zero both stat and endowed** when `minutes_played_derived <= 0` (unused subs / never on pitch).
4. `total_points = clip(stat_points_total + endowed_points, min=0)`.

### Output
- One CSV per match named `<HomeTeamNoSpaces>_<AwayTeamNoSpaces>_Points.csv`
- Default location when run standalone: `Tests/`
- Example: `Barcelona_NewcastleUnited_Points.csv`

---

## 6) Goalkeeper pipeline

### Files
- `Tests/keeper_stat_collection.py` — extracts GK-only stats from `content.playerStats`
- `Tests/calculate_keeper_points.py` — stat + endowed points; picks best-stat GK per team
- `scoring/goalkeeper_points.py` — weights and endowment rule constants

### Stat points
Linear weights on saves, passes, clearances, interceptions, tackles, long balls, punches, high claims, plus minutes term (`1/30` per minute).

### Endowed points (per team)
- Formula: `18 − 6 × goals_conceded_by_team`
- **Single GK played & minutes `< 45`:** baseline halved to `9` before concede penalty.
- **Multiple GKs played (minutes `> 0` each):** full `18` baseline (no halving); endowment is still one team-level number.

### Best-stat GK rule
When more than one goalkeeper plays for a team:
- **Endowed points** are computed once at team level.
- **Stat points** are taken from the GK with the highest `stat_points_total`.
- Only that GK row receives the team's endowed points in the output.

### Output
- `<HomeTeamNoSpaces>_<AwayTeamNoSpaces>_KeeperPoints.csv` (default: `Tests/` when run standalone)
- Columns include `stat_points_total`, `endowed_points`, `total_points` for the selected GK per team.

---

## 7) Final presentation merge

### File
`Tests/presentation_final_points.py`

### Purpose
Merges outfield `*_Points.csv` and `*_KeeperPoints.csv` into one audit-friendly file.

### Output
- `<HomeTeamNoSpaces>_<AwayTeamNoSpaces>_FinalPoints.csv`
- Columns: `player_name`, `player_id`, `team_name`, `position`, `stats_score`, `endowment_score`, `final_score` (rounded integer, floor 0)

### Keeper rows in FinalPoints
Each team gets one keeper line:
- `player_name` = `"<TeamName> Keepers"`
- `player_id` = `team_id` (FotMob club id, not an individual GK player id)
- `position` = `"goalkeeper"`

See [Goalkeeper representation in gameweek CSVs](#9-goalkeeper-representation-in-gameweek-csvs) below.

---

## 8) Scoring paths

There are **three ways** to run scoring. They share the same underlying modules but differ in outputs and a few merge rules.

```text
Match JSON
    │
    ├─► Path A: Per-match analysis (Tests/)
    │       point_simulator.py          → *_Points.csv (outfield)
    │       calculate_keeper_points.py    → *_KeeperPoints.csv
    │       presentation_final_points.py → *_FinalPoints.csv
    │
    ├─► Path B: Gameweek upload CSV
    │       procedures/generate_gameweek_scores.py
    │       → Scores/GW<gw_id>_scores.csv (all matches, one file)
    │
    └─► Path C: Round folder + GW rollup
            scripts/run_round_pipeline.py
            → Scores/<round>/matches/<Home>_<Away>/…
            → Scores/<round>/<round>_GW<gw_id>_scores.csv
```

### Path A — Per-match (`Tests/`)

**Use when:** debugging a single match, auditing stat vs endowment breakdown, generating `FinalPoints` for owner reports.

| Step | Script | Output |
|------|--------|--------|
| 1 | `point_simulator.py <match.json>` | `Tests/<Home>_<Away>_Points.csv` |
| 2 | `calculate_keeper_points.py <match.json>` | `Tests/<Home>_<Away>_KeeperPoints.csv` |
| 3 | `presentation_final_points.py <match.json>` | `Tests/<Home>_<Away>_FinalPoints.csv` |

`point_simulator` uses `simulate_points()` — includes `minutes_played_derived` zeroing and `clip(min=0)`.

### Path B — Gameweek CSV (`procedures/generate_gameweek_scores.py`)

**Use when:** uploading scores to the auction app for an active gameweek.

- Scores every `*.json` in a `Matches_Raw` folder.
- Uses inline `_score_outfield()` and `_score_keeper_units()` (same logic as `build_gw_scores_from_matches.py`).
- **Does not** call `simulate_points()` directly — merges `stat_points_total + endowed_points` without the extra `minutes_played_derived` guard or `clip(min=0)` (stat points are already zero when `minutes_played = 0`).
- Rounds `score` to nearest integer.
- Default output: `Scores/GW<gw_id>_scores.csv`

```bash
python procedures/generate_gameweek_scores.py \
  --matches-dir "Matches_Raw/CL_RO16_Leg2" \
  --gw-id 1
```

### Path C — Round pipeline (`scripts/run_round_pipeline.py`)

**Use when:** processing a full round with per-match artefacts under `Scores/`.

Per match under `Scores/<round>/matches/<Home>_<Away>/`:
- `stat_collection_outfield.csv` — raw extracted stats (all outfield roles)
- `<Home>_<Away>_Points.csv` — from `simulate_points()` (Path A logic)

GW rollup at `Scores/<round>/<round>_GW<gw_id>_scores.csv` uses the same rollup as Path B (`score_outfield` + `score_keepers_as_team_units`).

```bash
python scripts/run_round_pipeline.py \
  --matches-dir "Matches_Raw/CL_RO16_Leg2" \
  --gw-id 1
```

### Path comparison

| Behaviour | Path A (`simulate_points`) | Paths B & C (GW rollup) |
|-----------|---------------------------|-------------------------|
| Outfield merge | stat + endowed | stat + endowed |
| Zero when never on pitch | yes (`minutes_played_derived <= 0`) | no (relies on stat `minutes_played = 0`) |
| Floor at 0 | yes (`clip`) | no (negative totals possible before rounding) |
| Includes keepers | no (separate script) | yes (team unit rows) |
| Rounding | in `presentation_final_points` | integer round on `score` |

For normal match data the paths agree; edge cases (timeline vs stat minutes mismatch) may differ slightly.

---

## 9) Goalkeeper representation in gameweek CSVs

Gameweek upload CSVs (Paths B & C) include **one row per real outfield player** plus **one keeper unit row per team**.

| Column | Outfield player | Keeper unit |
|--------|-----------------|-------------|
| `player_id` | FotMob player id | **`team_id`** (club id) |
| `player_name` | Player display name | `"<TeamName> Keepers"` |
| `team_id` | Club id | Club id |
| `team_name` | Club name | Club name |
| `score` | stat + endowed (rounded) | best-stat GK stat + team endowed (rounded) |

### Why `player_id = team_id` for keepers?
The auction app treats goalkeeper ownership at **club level**: owning any GK from a club credits the owner with that club's keeper unit score for the round. Using `team_id` as the upload `player_id` for the unit row matches that rule and avoids double-counting individual backup keepers.

### Supabase / app upload
- SQL helper: `auction-app/scripts/sql/player-scores.sql` (`upsert_player_scores`)
- Publish script: `auction-app/scripts/publish-active-gameweek-scores.mjs` (see runbook)

Ensure keeper unit rows use `player_id` values that exist in `players` (typically seeded as club-level keeper placeholders) or appear in the missing-player report after publish.

---

## 10) Typical run order

### Single match (audit)
1. `stat_collection.py` (optional — for raw stat CSVs)
2. `point_simulator.py <match.json>`
3. `calculate_keeper_points.py <match.json>`
4. `presentation_final_points.py <match.json>`

### Full gameweek (production upload)
1. Place match JSON files in `Matches_Raw/<round>/`
2. `python procedures/generate_gameweek_scores.py --matches-dir … --gw-id …`
3. Publish CSV via auction-app procedure (see [`SCORING_OPERATIONS_RUNBOOK.md`](./SCORING_OPERATIONS_RUNBOOK.md))

### Full round (per-match artefacts + GW CSV)
1. `python scripts/run_round_pipeline.py --matches-dir … --gw-id …`
