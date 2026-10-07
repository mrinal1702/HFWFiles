# Positions — the shared position-ID → role map

`position_roles.py` decides which fantasy role (defender / midfielder / forward) a player
**played** in a match, from FotMob lineup position ids and "top player" slots. It is the single
source of truth used by **both**:

- `../scoring-engine/` — which position's scoring weights apply (and the FinalPoints `position`
  column → leaderboard "Match Pos");
- `../formation-engine/` — which roles a player is eligible for when picking the Best XI.

Changing it therefore changes **scores and formations at the same time**. Do it deliberately,
re-score affected matches, and recompute Best XI. Key constants: `WINGER_TOPPLAYERS_TO_MIDFIELD_POSITION_IDS`,
`GRANULAR_POSITION_IDS_ALWAYS_MIDFIELD`, `GRANULAR_POSITION_IDS_ALWAYS_FORWARD`.

Listed (pool) positions are separate: they come from the competition's
`player-pool/master_player_list.csv` (built by `../scoring-engine/build_master_player_csv.py`).

Tests: `python -m pytest positions` (two fixture-based tests skip when their World Cup sample
JSONs are not present).
