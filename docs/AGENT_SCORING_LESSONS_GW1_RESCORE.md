# Agent lessons: GW1 position-map rescore & keeper-zero incident (Jun 2026)

**Audience:** AI agents and operators maintaining HFW scoring, Supabase uploads, and Best XI leaderboards.

**Related:**
- [`AGENT_SCORES_AND_LEADERBOARD_WORKFLOW.md`](./AGENT_SCORES_AND_LEADERBOARD_WORKFLOW.md) — per-match World Cup workflow
- [`SCORING_OPERATIONS_RUNBOOK.md`](./SCORING_OPERATIONS_RUNBOOK.md) — GW rollback tags
- [`MAIN_PIPELINE_FUNCTIONS.md`](./MAIN_PIPELINE_FUNCTIONS.md) — pipeline internals

---

## Executive summary

In June 2026 we fixed FotMob **position mapping** (LM/RM → MID, `positionId` 85 → MID), rescored all 24 GW1 matches, and republished Best XI leaderboards. Two production bugs appeared:

1. **Position map** — 13 players changed role in GW1; 7 were owned on auctions 5/6/7. Best XI and totals changed legitimately (e.g. Salah FWD→MID).
2. **Keeper `final_score` = 0** — batch rescore script merged keeper rows **without computing `total_points`**, so every keeper uploaded as 0 until fixed.

**Prevention now in repo:** shared `Tests/final_points.py`, `build_keeper_unit_rows()` in `calculate_keeper_points.py`, validation before every Supabase upsert, and `Tests/validate_final_points.py` for agents to run manually.

---

## Incident timeline

| Step | What happened |
|------|----------------|
| 1 | Updated `Tests/position_roles.py` (LM/RM short codes, `positionId` 85 after topPlayers overrides) |
| 2 | Created `scripts/rescore_wc_gw1_finalpoints.py` to batch-regenerate FinalPoints from JSON |
| 3 | Upserted 1,144 GW1 rows → Supabase; published Best XI for auctions 5, 6, 7 |
| 4 | **Bug:** keepers showed `stats_score` + `endowment_score` in CSV but `final_score` always **0** |
| 5 | Root cause: renamed `total_points` → `final_score_raw` without ever setting `total_points` on keeper rows |
| 6 | Fixed one line; re-upserted; republished Best XI; updated git tag `points/gw1-rescore-position-map` |

**Git rollback tags:**

| Tag | Meaning |
|-----|---------|
| `points/gw1-pre-rescore` | Last commit before position-map rescore (`082596d`) |
| `points/gw1-rescore-position-map` | Rescored GW1 with keeper fix (`e503c35`+) |

See [`SCORING_OPERATIONS_RUNBOOK.md` § Rollback](./SCORING_OPERATIONS_RUNBOOK.md#rollback-gw1-points-one-step-revert).

---

## Position map changes (the legitimate rescoring)

**File:** `Tests/position_roles.py`  
**Resolver used by scoring:** `Tests/stat_collection.py` → `resolve_outfield_position_id_for_scoring()`

| Rule | Effect |
|------|--------|
| `leftmidfielder_short` / `rightmidfielder_short` | Map to MID (role id 2) |
| FotMob `positionId` **85** | Map to MID, applied **after** `topPlayers` striker overrides |

**Owned players affected on auctions 5/6/7 (examples):**

| Player | Old role | New role | Old pts | New pts |
|--------|----------|----------|---------|---------|
| Mohamed Salah | FWD | MID | 33 | 29 |
| John McGinn | FWD | MID | 32 | 32 |
| Yan Diomande | FWD | MID | 60 | 57 |
| Miguel Almirón | FWD | MID | 29 | 22 |
| Maxi Araújo | DEF | MID | 46 | 45 |
| Konrad Laimer | DEF | MID | 18 | 22 |
| Ousmane Dembélé | FWD | MID | 19 | 18 |

**Audit artifacts:** `Scores/gw1_position_map_affected_players.csv`, `Scores/audit_position_map_changes_gw1.py`

**Best XI impact:** formation optimizer picks different XIs when listed + match roles change (e.g. Antonio Lopez Cerrato A5: 376 → 371 after full fix with keepers).

---

## Keeper zero bug (the accidental rescoring)

### Symptom

- Leaderboard Best XI: every keeper line shows **0 pts**
- `*_FinalPoints.csv`: keeper rows like `Brazil Keepers,...,15.82,12.0,0` — components non-zero, `final_score` zero
- Supabase: `90008256` (Brazil Keepers) stored as `score: 0`

### Root cause (AI-relevant)

**Duplicate code paths** for building FinalPoints:

| Path | Keeper `total_points` computed? |
|------|----------------------------------|
| `fetch_fotmob_match.py --score` → reads `KeeperPoints.csv` | Yes (`calculate_keeper_points.py` main) |
| `presentation_final_points.py` → reads `KeeperPoints.csv` | Yes |
| `scripts/rescore_wc_gw1_finalpoints.py` (inline merge) | **No** — called `pick_best_stat_gk_per_team()` only |

The batch script renamed a column that did not exist:

```python
# BUG (fixed): total_points never created on keeper rows
keepers_final = best.rename(columns={"total_points": "final_score_raw", ...})
merged["final_score_raw"] = ...fillna(0.0)  # → all keepers became 0
```

### Fix

1. `calculate_keeper_points.build_keeper_unit_rows()` — single function that always sets `total_points`
2. `Tests/final_points.merge_outfield_and_keepers()` — shared merge + `validate_final_points_df()`
3. Batch rescore → `scripts/rescore_finalpoints.py` uses the shared path
4. `upsert-player-scores-from-finalpoints.mjs` **rejects** corrupt keeper rows before write

---

## Architecture agents must understand

### Three layers (do not conflate)

```
Match JSON
    → FinalPoints.csv (per match, source for public scores + upload)
        → Player_Scores / player_scores (Supabase, per player_id + game_week_id)
            → Best XI compute → auction_leaderboard.total_score + gameweek_squads.is_best_xi
```

| Layer | Wrong tool | Right tool |
|-------|------------|------------|
| Upload per-player GW scores | `npm run procedure:publish-active-gw` | `npm run upsert:player-scores` |
| Manager GW totals | `populate:auction-scores` (sums **all** squad players) | `npm run publish:best-xi` |
| Display formation / XI slots | Supabase alone | `auction-app/data/best-xi/auction-{id}-gw{n}.json` + Supabase |

### Keeper identity (critical)

| Context | `player_id` |
|---------|-------------|
| FinalPoints CSV keeper row | FotMob **`team_id`** (e.g. `8256`) |
| Supabase `Player_Scores` / auction squads | **`90_000_000 + team_id`** (e.g. `90008256`) |

`upsert-player-scores-from-finalpoints.mjs` remaps via `resolveScorePlayerId()`.  
`procedures/best_xi.py` → `keeper_score()` tries squad `player_id` then raw `team_id`, then reads from GW scores dict keyed by `9000…` ids.

**Never upload keeper rows with raw `team_id` only** — legacy rows are deleted on upsert, but Best XI lookup expects `9000…` in `player_scores`.

### Best XI scoring inputs

- **Squad:** locked `gameweek_squads` (not live `auction_teams`)
- **Per-player points:** `player_scores` for that `game_week_id`
- **Eligible roles:** master list position ∪ in-match roles from **all** GW match JSONs in `Matches_Raw/World Cup 2026/`
- **Code:** `procedures/best_xi.py`, `procedures/compute_auction_best_xi.py`, `auction-app/scripts/publish-best-xi-from-json.mjs`

---

## Mandatory checks before next GW upload

Run after generating or amending any `*_FinalPoints.csv`:

```powershell
cd C:\Users\trive\HFWFiles

# 1. Validate all GW FinalPoints (Python)
python Tests/validate_final_points.py "Matches_Raw/World Cup 2026/*_FinalPoints.csv"

# 2. Spot-check one keeper row in CSV (stats + endowment → final_score)
Select-String -Path "Matches_Raw\World Cup 2026\England_Croatia_FinalPoints.csv" -Pattern "Keepers"

# 3. Upsert (validation runs automatically inside the script)
cd auction-app
$files = Get-ChildItem "..\Matches_Raw\World Cup 2026\*_FinalPoints.csv" | % { $_.FullName }
npm run upsert:player-scores -- 1 @files

# 4. Recompute + publish Best XI per auction
cd ..
python procedures/compute_auction_best_xi.py --auction-id 5 --gw-id 1 --output Scores/best_xi_auction_5_gw1.json
# ... repeat for 6, 7 (or GW2 when applicable)
cd auction-app
npm run publish:best-xi -- --auction-id 5 --gw-id 1
```

**Sanity query after upsert** (keepers must be > 0 when they played):

```javascript
// In auction-app with .env.local loaded — example IDs
// select player_id, score from player_scores where game_week_id = 1 and player_id >= 90000000 limit 10;
```

**Sanity in Best XI compute output:** lines like `GK Brazil Keepers (90008256) = 28`, not `= 0`.

---

## Per-match scoring (GW2+ default path)

**Do not write a new one-off merge.** Use:

```powershell
python Tests/fetch_fotmob_match.py "<fotmob-url>" --score
```

This runs `point_simulator` → `calculate_keeper_points` → `final_points.merge_outfield_and_keepers()` (via `fetch_fotmob_match._merge_final_points`).

**Batch rescore** (amend whole folder after rule change):

```powershell
python scripts/rescore_finalpoints.py --matches-dir "Matches_Raw/World Cup 2026" --copy-to-app
```

---

## Common agent mistakes (theoretical training data)

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Copy-paste merge logic without `total_points` for keepers | All keepers = 0 | Use `Tests/final_points.py` only |
| Run `upsert` and `compute_best_xi` in parallel | Stale/zero keeper scores in XI | Upsert first, then compute |
| Use `publish-active-gw` for WC | Wrong keeper ids | `upsert:player-scores` only |
| Use `populate:auction-scores` for leaderboard | Totals = sum of all 18 players | `publish:best-xi` only |
| Forget `auction-app/data/best-xi/*.json` on deploy | Scores correct, formation overlay stale | Commit JSON + push `main` |
| Rescore without republishing Best XI | `Player_Scores` updated, `auction_leaderboard` stale | Always run publish-best-xi after upsert |
| Assume `position` in master list is only role source | Wrong XI slots | Union with match JSON roles |
| Regenerate master player list unasked | Wipes pool / breaks auctions | Hard rule in agent workflow doc |

---

## Files changed in this incident (reference)

| Area | Files |
|------|-------|
| Position map | `Tests/position_roles.py`, `Tests/stat_collection.py`, `Tests/endowed_points.py` |
| Batch rescore | `scripts/rescore_finalpoints.py`, `scripts/rescore_wc_gw1_finalpoints.py` (wrapper) |
| Shared merge + validation | `Tests/final_points.py`, `Tests/validate_final_points.py` |
| Keeper units | `Tests/calculate_keeper_points.py` → `build_keeper_unit_rows()` |
| Upload guard | `auction-app/scripts/lib/validate-final-points.mjs` |
| Best XI | `Scores/best_xi_auction_*_gw1.json`, `auction-app/data/best-xi/` |
| Raw outputs | `Matches_Raw/World Cup 2026/*_FinalPoints.csv` |
| Docs | This file, `SCORING_OPERATIONS_RUNBOOK.md` rollback section |

---

## Commissioner-visible leaderboard after full fix (GW1)

| Auction | Leader | Best XI total |
|---------|--------|---------------|
| 5 | Easy Money | 497 |
| 6 | Ishaan | 514 |
| 7 | E/M | 471 |

Live: https://hfwauction.vercel.app/leaderboard/{5,6,7}
