# Formation engine (`formation-engine/`)

Picks each manager's **Best XI** for one auction gameweek under the formation rule. Pure Python,
runs locally; output is published to Supabase by `auction-app/scripts/publish-best-xi-from-json.mjs`.
**Scope:** formation / eligibility only. Do not change scoring (`../scoring-engine/`) or the website from here.

## Input → output
- **In:**
  - locked squads for that auction + GW (`gameweek_squads`, read from Supabase)
  - player scores for that GW (`Player_Scores`)
  - the competition's player pool (`competitions/<…>/<slug>/player-pool/master_player_list.csv`) → **listed position**
  - a flat folder of that GW's match JSONs (`*_Vs_*.json`) → **in-match roles**
- **Out:** `best_xi_auction_{id}_gw{legacyGwId}.json` (managers → formation, goalkeeper, outfield
  picks with role + score, total_points). Keep that format stable — the publish script and the
  leaderboard formation display read it.

## Rules (in code — change here, never in the UI)
- `best_xi.py` → `ALLOWED_FORMATIONS` (D-M-F): 3-5-2, 3-4-3, 4-5-1, 4-4-2, 4-3-3, 5-4-1, 5-3-2; one goalkeeper unit.
- Eligibility = listed pool role ∪ roles played in that GW's matches (`formation_match_roles.py`,
  which uses the shared position map `../positions/position_roles.py`).
- Highest legal total wins; everyone else is bench.

## Files
| File | Role |
|------|------|
| `best_xi.py` | Formation solver + eligibility |
| `formation_match_roles.py` | In-match roles per player (via `position_roles.py`) |
| `compute_auction_best_xi.py` | CLI: one auction + GW → Best XI JSON |
| `generate_gameweek_scores.py` | Older GW rollup helper |
| `audit_ingame_formation_usage.py` | Audit tool |

Usage and the full publish checklist: `auction-app/docs/OPS_SCORING_AND_LEADERBOARD.md` §4.
Always pass the **legacy** GW id (e.g. UCL MW2 = 301) and that competition's master list.
