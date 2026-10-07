# Scoring engine (currently `Tests/` — planned rename: `scoring-engine/`)

Turns one FotMob match into per-player fantasy points. Pure Python, runs locally, never deployed.
**Scope:** scoring only. Leaderboards, squads, Best XI and the website are elsewhere — do not
edit them from here.

## Input → output
- **In:** a FotMob match JSON (fetched by `fetch_fotmob_match.py <url> --out <file>`).
- **Out:** `<Home>_<Away>_FinalPoints.csv` — the only thing other layers consume. Fixed columns:
  `player_name, player_id, team_name, position, stats_score, endowment_score, [shootout_score], final_score`.
  - Keeper rows: one per club, `player_id` = **team_id**, `player_name` = "<Club> Keepers".
    (The upsert step remaps them to `90_000_000 + team_id`.)
  - `position` = in-match scoring role (defender / midfielder / forward / goalkeeper). It feeds
    the leaderboard "Match Pos" column and Best XI eligibility.
- Keep that format stable. Algorithm changes are fine; format changes break the app and
  `procedures/`.

## Main files
| File | Role |
|------|------|
| `fetch_fotmob_match.py` | Fetch match JSON (match id from URL); `--score` runs the pipeline |
| `stat_collection.py`, `keeper_stat_collection.py` | Extract outfield / keeper stats |
| `Calculate_stat_points.py`, `calculate_keeper_points.py` | Stat points |
| `endowed_points.py`, `calculate_endowed_points.py` | Endowment (position-based) points |
| `penalty_shootout_points.py` | Shootout points (knockouts) |
| `final_points.py` | Combine → FinalPoints |
| `point_simulator.py` | Run the whole pipeline for one match |
| `validate_final_points.py` | Validate a FinalPoints CSV (`npm run validate:final-points` in auction-app) |
| `position_roles.py` | **Shared** position-ID → role map (also imported by `procedures/`). Change with care: it moves both scores and formation eligibility. Planned move: `positions/` |
| `fetch_fotmob_squads.py`, `build_master_player_csv.py`, `fotmob_player_profile.py` | Player-pool prep (squad scrape → master list) |
| `test_*.py` | pytest tests |

Sample/debug data (`Match1.json`, `Matches/`, `export_run/`, loose CSVs) are defaults or test
fixtures used by the scripts — do not move them without updating the scripts.

## Docs
`../docs/MAIN_PIPELINE_FUNCTIONS.md` (pipeline detail), `../docs/STAT_COLLECTION_AND_WORKFLOW.md`,
`../docs/AUCTION_PREPARATION_PROCEDURE.md` (player pool).

## Active use
The live UCL 2026/27 scorer (`competitions/active/uefa-cl-2026-27/rounds/mw01/_score_ucl_match.py`)
imports from this folder by path. Renaming/moving files here breaks it — coordinate first.
