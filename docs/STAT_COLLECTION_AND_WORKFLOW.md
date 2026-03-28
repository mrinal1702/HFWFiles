# Stat collection and match workflow

This document is the handoff reference for how football match JSON (FotMob-style) is turned into per-player stat tables and how defender fantasy weights relate. Use it when continuing work in a new chat or with another agent.

## Repository layout (relevant parts)

| Path | Role |
|------|------|
| `Tests/stat_collection.py` | **Primary pipeline**: reads a match JSON file, extracts outfield player stats, splits by position, writes CSVs. |
| `scoring/defender_points.py` | **Defender point weights** and stat-key mapping (`DEFENDER_SCORING`, versioned). |
| `Tests/Match1.json`, `Tests/Matches/*.json` | Example match payloads (not required for the logic; any compatible JSON path works). |

## Input data: match JSON

- Top-level keys typically include: `general`, `header`, `nav`, `content`, `seo`.
- **`content.playerStats`**: nested per-player statistics (stat keys like `minutes_played`, `ground_duels_won`, `dribbles_succeeded`, `missed_penalty`, etc.).
- **`content.lineup`**: `homeTeam` / `awayTeam` → `starters` and `subs` with `usualPlayingPositionId` (0 GK, 1 DEF, 2 MID, 3 FWD).
- **`content.matchFacts.events.events`**: chronological events (e.g. `type: "Card"` with `card: "Red"` for red cards; `type: "MissedPenalty"` for penalty misses in the timeline).
- **`content.stats`**: team-level aggregates (e.g. `shots_woodwork` for team woodwork).
- **`content.shotmap`**: may be a dict with `shots` (all match shots) and `Periods` — useful for shot-level flags (e.g. `isSavedOffLine`).

## What `stat_collection.py` does

1. Loads JSON (default `Tests/Match1.json`, or first CLI argument, or env `STAT_COLLECTION_JSON`).
2. Builds **position map** from `content.lineup` (`usualPlayingPositionId`); falls back to `usualPosition` on the player blob if needed.
3. **Excludes goalkeepers** (`isGoalkeeper` or position 0).
4. Keeps only **defenders (1), midfielders (2), forwards (3)** in separate DataFrames.
5. Flattens **`playerStats`** sections into metrics (first occurrence of each `stat` key wins if duplicated).
6. **Derived fields** where applicable: e.g. inaccurate passes = total passes − accurate passes; ground-duel “lost” proxy = total − won on `ground_duels_won`; same idea for aerial duels and for **dribbles** (`dribbles_succeeded` value/total).
7. **Defaults**: cross/long-ball and `missed_penalty` use **0** when the stat block is absent.
8. **Red cards**: counted from timeline `content.matchFacts.events.events` (`Card` + `Red` only); yellows are ignored.
9. Writes three CSVs next to the script: `stat_collection_defenders.csv`, `stat_collection_midfielders.csv`, `stat_collection_forwards.csv`. If a file is locked, it may write under `Tests/export_run/` instead.

### Running

```text
python Tests/stat_collection.py
python Tests/stat_collection.py "C:\path\to\match.json"
set STAT_COLLECTION_JSON=C:\path\to\match.json && python Tests/stat_collection.py
```

Importing programmatically: `from stat_collection import stat_collection` (run with project root on `PYTHONPATH` so `Tests` and `scoring` resolve as needed).

## Stat columns (conceptual)

The script outputs identity columns (`player_id`, `player_name`, `team_id`, `team_name`, `usual_playing_position_id`) plus metrics including: minutes, goals, assists, passing, shooting, tackles, blocks, clearances, headed clearances, interceptions, recoveries, `dribbled_past`, ground/aerial duels, fouls, crosses, long balls, `missed_penalty`, dribble success/attempts/failed, `red_cards`, etc. Exact column order is defined in `row_from_player()` in `stat_collection.py`.

**Important distinctions**

- **Take-ons**: `dribbles_succeeded` (successful vs failed take-on) — not the same as **ground duels**.
- **Tackles lost (proxy)**: derived from **ground duels** (`total − value` on `ground_duels_won`), not from dribble stats.

## Defender scoring (`scoring/defender_points.py`)

- **`DEFENDER_WEIGHTS`**: linear points per unit (and special cases noted in module docstring).
- **`DEFENDER_FORMULAS`**: e.g. dispossessed formula, minutes per point.
- **`DEFENDER_STAT_KEYS`**: maps logical names to JSON stat keys or `_derived_*` hints.
- **Version** is in `DEFENDER_SCORING["version"]`.

Current rules worth remembering:

- **Clearances**: use weight **`clearances` once** on **(clearances + headed_clearance)** so headed and foot clearances are not double-counted as two separate weighted columns.
- **`errors_led_to_goal`**: **−5** per event.
- **`dribbled_past`**: **−1.6** per occurrence (same as `tackles_lost` weight).
- **`recoveries`**: collected in CSV; **no weight assigned yet**.
- **`duels_won` (aggregate)**: **ignored** for scoring.
- **Woodwork**: weight exists in config but **per-player availability varies by JSON** — confirm `shots_woodwork` or equivalent in each file before applying.
- **Recoveries / yellow cards / some errors**: see `STATS_STILL_MISSING_OR_EXTERNAL`, `STATS_NO_WEIGHT_ASSIGNED`, `STATS_IGNORED_FOR_SCORING` in the same module.

## What this document does *not* cover

- Midfielder and forward scoring systems (to be added later).
- Automated tests or temporary CSV exports — the **source of truth** for extraction logic is **`stat_collection.py`**; scoring constants live in **`scoring/defender_points.py`**.

## Next steps for a new agent

1. Read `Tests/stat_collection.py` for exact column definitions and parsing rules.
2. Read `scoring/defender_points.py` for defender weights and mappings.
3. When adding midfielder/forward weights, mirror the pattern: a module under `scoring/`, stat keys aligned with columns from the same JSON.
4. For woodwork or rare events, grep new match JSON for player-level keys and update `STATS_STILL_MISSING_OR_EXTERNAL` / weights accordingly.
