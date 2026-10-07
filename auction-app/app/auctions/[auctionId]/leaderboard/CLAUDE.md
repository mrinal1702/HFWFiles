# Leaderboard — the scoring surface

Contract (read first): `auction-app/docs/ui-contracts/LEADERBOARD.md`.

- Tabs, exactly three: **Standings · My Points · Competitors – Points**.
- My Points / Competitors – Points: one GW at a time via the GW dropdown (default = latest GW with
  scores). Table columns: **Player · Club · Listed Pos · Match Pos · Score**; after Best XI publish:
  Starting XI (with formation chip) + Bench. Built from `_components/GwPointsView.tsx` +
  `GwSquadTable.tsx` — reuse them, never add another layout.
- Data: `lib/scoring/` only (locked `gameweek_squads`, `Player_Scores`, `auction_leaderboard`,
  `data/best-xi` overlays, Match Pos from registered FinalPoints sheets). Never budgets, bids or
  live squads.

**A new gameweek is data, not code.** If a GW looks wrong (no formation, blank Match Pos, missing
standings), the publish step is incomplete — fix the data (see `docs/OPS_SCORING_AND_LEADERBOARD.md`),
do not patch the UI. Diagnose with:

```bash
node scripts/check-gameweek-surfaces.mjs --auction-ids <id>
```

It also fails if code here special-cases a gameweek number or auction id.
