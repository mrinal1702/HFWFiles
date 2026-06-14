# Stat collection and match workflow

Handoff reference for how FotMob-style match JSON becomes per-player stat tables, fantasy points, and gameweek upload rows. Use when continuing work in a new chat or with another agent.

**Pipeline overview and scoring paths:** [`MAIN_PIPELINE_FUNCTIONS.md`](./MAIN_PIPELINE_FUNCTIONS.md)  
**Weekly ops (build CSV → publish):** [`SCORING_OPERATIONS_RUNBOOK.md`](./SCORING_OPERATIONS_RUNBOOK.md)

## Repository layout (relevant parts)

| Path | Role |
|------|------|
| `Tests/stat_collection.py` | Extract outfield stats; split by scoring role |
| `Tests/position_roles.py` | In-match position resolution and winger/striker overrides |
| `Tests/Calculate_stat_points.py` | Apply role weights → stat points |
| `Tests/endowed_points.py` / `calculate_endowed_points.py` | On-pitch intervals → endowed points |
| `Tests/point_simulator.py` | Merge stat + endowed (outfield); per-match `*_Points.csv` |
| `Tests/keeper_stat_collection.py` | Extract goalkeeper stats |
| `Tests/calculate_keeper_points.py` | GK stat + team endowment; best-stat GK selection |
| `Tests/presentation_final_points.py` | Merge outfield + keeper → `*_FinalPoints.csv` |
| `procedures/generate_gameweek_scores.py` | All matches in a folder → one GW upload CSV |
| `scripts/run_round_pipeline.py` | Round folder → per-match exports + GW rollup |
| `scoring/*.py` | Versioned weights per role (DEF / MID / FWD / GK) |
| `Matches_Raw/` | Raw match JSON by competition round |
| `Scores/` | Generated per-round and GW score CSVs |

## Input data: match JSON

- Top-level keys typically include: `general`, `header`, `nav`, `content`, `seo`.
- **`content.playerStats`**: nested per-player statistics (stat keys like `minutes_played`, `ground_duels_won`, `dribbles_succeeded`, `penalties_won`, `missed_penalty`, etc.).
- **`content.lineup`**: `homeTeam` / `awayTeam` → `starters` and `subs` with `usualPlayingPositionId` (0 GK, 1 DEF, 2 MID, 3 FWD) and granular `positionId`.
- **`content.matchFacts.topPlayers`**: optional `positionLabel.key` (e.g. `striker_short`, `leftwinger_short`) used for role overrides.
- **`content.matchFacts.events.events`**: chronological events (`Substitution`, `Goal`, `Card` + `Red`, etc.).
- **`content.stats`**: team-level aggregates (e.g. `shots_woodwork`).
- **`content.shotmap`**: shot-level flags (e.g. `isSavedOffLine`) — not summed in playerStats today.

## What `stat_collection.py` does

1. Loads JSON (default `Tests/Match1.json`, or first CLI argument, or env `STAT_COLLECTION_JSON`).
2. Builds **position map** from `content.lineup` (`usualPlayingPositionId`); falls back to `usualPosition` on the player blob if needed.
3. Applies **role overrides** from `position_roles.role_override_by_player()` (see below).
4. **Excludes goalkeepers** (`isGoalkeeper` or position 0).
5. Keeps only **defenders (1), midfielders (2), forwards (3)** in separate DataFrames.
6. Flattens **`playerStats`** sections into metrics (first occurrence of each `stat` key wins if duplicated).
7. **Derived fields**: inaccurate passes = total − accurate; **ground-duel lost** = total − won on `ground_duels_won` (column `ground_duels_lost` — audit only, **not** scored as tackles lost); same for aerial duels; **dribbles failed** = attempts − successes on `dribbles_succeeded`; **`tackles_lost`** = FotMob **`dribbled_past`** (times beaten by an opponent dribble when defending).
8. **Defaults**: cross/long-ball, `missed_penalty`, and `penalties_won` use **0** when the stat block is absent.
9. **Red cards** and **own goals** from timeline events (not playerStats keys).
10. Writes three CSVs: `stat_collection_defenders.csv`, `stat_collection_midfielders.csv`, `stat_collection_forwards.csv` (or `Tests/export_run/` if locked).

### Running

```text
python Tests/stat_collection.py
python Tests/stat_collection.py "C:\path\to\match.json"
set STAT_COLLECTION_JSON=C:\path\to\match.json && python Tests/stat_collection.py
```

Importing programmatically: `from stat_collection import stat_collection` (add repo root and `Tests` to `PYTHONPATH`).

## Position overrides (`Tests/position_roles.py`)

Scoring role for a match may differ from the player's auction-pool position in `master_player_list.csv`. Overrides apply **per match** to both stat weights and endowed rules.

### Resolution order
1. Start with `usualPlayingPositionId` from lineup (starters + subs).
2. If missing, use `usualPosition` on the playerStats blob.
3. Apply `role_override_by_player()` from `content.matchFacts.topPlayers`.

### Override rules

| Source | Condition | Scoring role |
|--------|-----------|--------------|
| `striker_short` | always | Forward (`3`) |
| `leftwinger_short` / `rightwinger_short` | granular `positionId` ∈ `{83, 87}` | Midfielder (`2`) |
| `leftwinger_short` / `rightwinger_short` | any other `positionId` (e.g. `103`, `107`) | No override — stays usual position (typically Forward) |

Granular `positionId` comes from `content.lineup.*.positionId` (FotMob formation slot, not the same as `usualPlayingPositionId`).

**Example (Barcelona sample):** Yamal RW (`positionId` 83) and Raphinha LW (87) score as midfielders when labeled as wingers in topPlayers; Barnes (107) and Elanga (103) remain forwards.

To add more wide-forward slots for a competition, extend `WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS` in `position_roles.py`.

### Shared usage
The same resolution is used in:
- `stat_collection.row_from_player()`
- `endowed_points` / `calculate_endowed_points`
- `formation_match_roles.py` / best-XI procedures

## Stat columns (conceptual)

Identity: `player_id`, `player_name`, `team_id`, `team_name`, `usual_playing_position_id`.

Metrics include: minutes, goals, assists, passing, shooting, tackles, blocks, clearances, headed clearances, interceptions, recoveries, `dribbled_past`, ground/aerial duels, fouls, crosses, long balls, **`penalties_won`**, `missed_penalty`, dribble success/attempts/failed, `red_cards`, `own_goals`, etc. Exact columns are in `row_from_player()` in `stat_collection.py`.

**Penalty stats (FotMob → pipeline)**

| Column | Source | Scoring |
|--------|--------|---------|
| `penalties_won` | `playerStats` key `penalties_won` | **+5** per event, all outfield roles; independent of whether the pen was scored |
| `missed_penalty` | `playerStats` key `missed_penalty` | **−5** per miss (taker) |
| Penalty goal | `goals` + timeline `goalDescriptionKey: "penalty"` | **+10** to scorer via `goals` weight |

FotMob does **not** count penalty won as an `assist`. There is no per-incident link in JSON between who won a pen and who scored it — only aggregate counts and timeline goals/misses.

**Important distinctions (duels, tackles, take-ons)**

| Concept | FotMob key | `stat_collection` column | Scoring weight |
|--------|------------|--------------------------|----------------|
| Tackles **won** | `matchstats.headers.tackles` | `tackles` | `tackles_won` |
| Tackles **lost** (beaten by dribble) | `dribbled_past` | `tackles_lost` | `tackles_lost` |
| Failed take-on (attacker) | `dribbles_succeeded` (total − value) | `dribbles_failed` | `dribbles_lost` |
| Ground duels lost | `ground_duels_won` (total − value) | `ground_duels_lost` | **not scored** (since 2026-06) |

FotMob does **not** expose a separate “tackles lost” count — only tackles won and **dribbled past**.

**Older mistake (pre-2026-06):** `tackles_lost` was incorrectly set to all **ground duels lost**, which double-penalised active players and overlapped with `dribbles_failed` for forwards.

## Role scoring (`scoring/`)

All four outfield/GK roles have versioned configs:

| Module | Export | Notes |
|--------|--------|-------|
| `defender_points.py` | `DEFENDER_SCORING` | Clearances once on `clearances_total`; see module for pending stats |
| `midfielder_points.py` | `MIDFIELDER_SCORING` | Same structural pattern as defender |
| `forward_points.py` | `FORWARDS_SCORING` | Same structural pattern as defender |
| `goalkeeper_points.py` | `GOALKEEPER_SCORING` | Endowment rules implemented in `calculate_keeper_points.py` |

Each outfield config provides `weights`, `formulas` (minutes + dispossessed), and `stat_keys` mapping logical names to `stat_collection` columns.

### Scoring rule changelog

Rule changes apply to **matches scored after the change** unless a gameweek is explicitly re-run and re-published. Do not amend published GW scores retroactively without commissioner sign-off.

| Date | Rule | Code / docs |
|------|------|-------------|
| **2026-06** | **`penalties_won`: +5** per penalty won (defender, midfielder, forward). Does not require conversion; same player can win and score without extra assist logic. | `stat_collection.py` (`penalties_won` column); `scoring/*_points.py` (`penalties_won: 5.0`) |
| **2026-06** | **Forward `aerial_duels_lost`: weight 0** (was erroneously +0.4). No points or penalty for lost aerials for forwards only. | `scoring/forward_points.py` |
| **2026-06** | **`tackles_lost`**: use FotMob **`dribbled_past`** (times beaten by a dribble), **not** ground duels lost. Remove separate `dribbled_past` scoring weight (avoids double penalty). Failed take-ons still use `dribbles_failed` → weight `dribbles_lost`. GW1 World Cup matches re-scored and re-published. | `stat_collection.py` (`tackles_lost` column); `scoring/*_points.py` |

**Example (Qatar 1–1 Switzerland, when scored with 2026-06 rules):** Remo Freuler `penalties_won = 1` → **+5** stat points; Breel Embolo gets **+10** via `goals` for the converted pen; Freuler gets **no** assist from FotMob `assists`.

### Defender rules worth remembering
- **Clearances**: weight applied once to `(clearances + headed_clearance)`.
- **`errors_led_to_goal`**: −5 per event.
- **`tackles_lost`**: −1.6 per FotMob **`dribbled_past`** (defender beaten by a dribble).
- **`dribbles_lost`**: −0.8 per failed take-on (`dribbles_failed`).
- **`recoveries`**: collected; no weight yet.
- **`duels_won` / `ground_duels_lost` (aggregate)**: ignored for scoring.
- **Woodwork**: weight exists; per-player key availability varies by JSON.

See `STATS_STILL_MISSING_OR_EXTERNAL`, `STATS_NO_WEIGHT_ASSIGNED`, `STATS_IGNORED_FOR_SCORING` in `scoring/defender_points.py` (and equivalents in other role files where documented).

## Endowed points (summary)

Derived from substitution timeline + goal events while player is on field. Role bases and goal modifiers are in `endowment_points_for_position()` in `endowed_points.py`. Uses the same position overrides as stat collection. Halving when derived minutes `< 45`.

## Scoring paths (which script when)

| Goal | Script(s) | Output |
|------|-----------|--------|
| Debug one match, full breakdown | `point_simulator.py`, `calculate_keeper_points.py`, `presentation_final_points.py` | `Tests/*_Points.csv`, `*_KeeperPoints.csv`, `*_FinalPoints.csv` |
| Upload gameweek to app | `procedures/generate_gameweek_scores.py` | `Scores/GW<n>_scores.csv` |
| Round folder + per-match files | `scripts/run_round_pipeline.py` | `Scores/<round>/matches/…` + GW CSV |

**Path difference:** `point_simulator.simulate_points()` also zeroes players with `minutes_played_derived <= 0` and floors `total_points` at 0. GW rollup scripts merge stat + endowed directly (normally equivalent). Details in [`MAIN_PIPELINE_FUNCTIONS.md` § Scoring paths](./MAIN_PIPELINE_FUNCTIONS.md#8-scoring-paths).

## Goalkeeper representation

Individual GKs are scored internally, but **gameweek and FinalPoints outputs expose one row per team**:

- `player_name`: `"<TeamName> Keepers"`
- `player_id`: **`team_id`** (club FotMob id)
- `position`: `goalkeeper`
- `score`: stat points from the **best-stat GK** who played + **team-level** endowment (`18 − 6 × conceded`, with single-GK `<45` min halving)

Multiple GKs in one match: endowment is not split; only the highest stat-points GK receives the unit row.

Auction ownership: owning any goalkeeper from a club credits that club's keeper unit — see [`OWNER_SCORE_REPORT_WORKFLOW.md`](./OWNER_SCORE_REPORT_WORKFLOW.md) § goalkeeper ownership.

## Next steps for a new agent

1. Read `Tests/stat_collection.py` and `Tests/position_roles.py` for extraction and role rules.
2. Read the relevant `scoring/<role>_points.py` for weights.
3. For a single-match audit, run Path A in `MAIN_PIPELINE_FUNCTIONS.md`.
4. For production upload, follow `SCORING_OPERATIONS_RUNBOOK.md`.
5. For woodwork or rare events, grep match JSON for player-level keys and update scoring config / `STATS_STILL_MISSING_OR_EXTERNAL`.
6. To change winger→midfielder behaviour, edit `WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS` — do not change master-list LW/RW → Forward mapping unless auction pool rules change.
