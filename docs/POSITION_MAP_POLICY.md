# Position map policy (GW1 frozen, GW2+ complete map)

## Summary

| Gameweek | topPlayers map | Action |
|----------|----------------|--------|
| **GW1** (24 group matches) | **Frozen** — map at `points/gw1-rescore-position-map` (LM/RM, striker, winger 83/87, granular 85) | **Do not** batch-rescore or re-upsert GW1 FinalPoints |
| **GW2+** | **Complete** — adds CB/LB/RB, CM/CDM/CAM, conditional wing-backs | Use `fetch_fotmob_match.py --score` for new matches |

GW1 Supabase `Player_Scores`, Best XI, and leaderboards stay as published. The expanded rules in `Tests/position_roles.py` apply to **new scoring runs from GW2 onward**.

---

## GW1 freeze (hard rule for agents)

**Do NOT:**

- Run `python scripts/rescore_finalpoints.py --matches-dir "Matches_Raw/World Cup 2026"` on all GW1 JSONs
- Re-run `fetch_fotmob_match.py --score` on existing GW1 match JSONs unless the commissioner explicitly requests a single-match amendment
- Upsert GW1 `*_FinalPoints.csv` after regenerating with the v2 topPlayers map

**GW1 is correct as live** at:

- Tag: `points/gw1-rescore-position-map`
- Supabase `game_week_id = 1`
- Leaderboards: auctions 5, 6, 7

---

## GW2+ complete topPlayers map

**Code:** `Tests/position_roles.py`  
**Reference:** `Scores/gw1_topplayers_position_map.json` (schema; `applies_from_gw: 2`)

| `positionLabel.key` | Role | Rule |
|---------------------|------|------|
| `centerback_short`, `leftback_short`, `rightback_short` | DEF | Unconditional |
| `left_wing_back_short`, `right_wing_back_short` | DEF | Only if lineup `usualPlayingPositionId` is 1 |
| `centermidfielder_short`, `centerdefensivemidfielder_short`, `centerattackingmidfielder_short` | MID | Unconditional |
| `leftmidfielder_short`, `rightmidfielder_short` | MID | Unconditional |
| `striker_short` | FWD | Unconditional |
| `leftwinger_short`, `rightwinger_short` | MID | Only if granular `positionId` ∈ {83, 87} |
| Granular `positionId` **85** | MID | Always (after topPlayers step) |

**Known winger edge case (unchanged):** granular **103** / **107** with winger label → stay on lineup usual (typically FWD).

---

## Per-match workflow (GW2+)

```powershell
python Tests/fetch_fotmob_match.py "<fotmob-url>" --score
python Tests/validate_final_points.py "Matches_Raw/World Cup 2026/<Match>_FinalPoints.csv"
cd auction-app
npm run upsert:player-scores -- 2 path\to\new\FinalPoints.csv
# Then recompute Best XI + publish when GW2 squads are locked
```

Use the correct `game_week_id` (2 for GW2) on upsert.

---

## If GW1 must ever be amended

1. Commissioner sign-off only  
2. Score **one** match with documented reason  
3. Upsert **only** that match’s FinalPoints for `game_week_id = 1`  
4. Recompute Best XI for affected auctions  
5. Do **not** batch-rescore all 24 GW1 files with the v2 map without explicit approval  

Impact if v2 were applied to all GW1: 10 players change points (see `Scores/gw1_topplayers_map_expansion_impact.json`).
