---
name: leaderboard-ui
description: Apply the frozen HFW auction leaderboard UI contract for Standings, My Points, and Competitors. Use when editing /leaderboard routes, GwPointsView, GameweekSquadView, CompetitorsPointsList, leaderboard-data, or when the user mentions leaderboard, My Points, Match Pos, Best XI UI, or gameweek dropdown.
---

# Leaderboard UI

Before any edit, read `auction-app/docs/ui-contracts/LEADERBOARD.md` and follow it.

## Required behaviour

1. Do not change UI unless the user explicitly asked for that change.
2. My Points and Competitors: one dropdown, one gameweek on screen. URL `tab` + `gw`.
3. Default GW = latest gameweek with scores uploaded.
4. Table columns: Player, Club, Listed Pos, Match Pos, Score.
5. Season total only as a small header box on My Points; rankings stay on Standings.
6. After Best XI publish for that GW: Starting XI + formation + substitutes (`GwSquadTable` / `GameweekSquadView` precedent).
7. If the user explicitly changes this UI, update `LEADERBOARD.md` in the same change.
8. Missing Match Pos or formation is almost always **ops/data** (sheets + `data/best-xi/auction-{id}-gw{legacyGwId}.json` not deployed) — fix via [OPS_SCORING_AND_LEADERBOARD.md](../../auction-app/docs/OPS_SCORING_AND_LEADERBOARD.md), not new UI.

## Do not

- Add a tab per gameweek
- Add per-GW score columns beside Total
- Restyle chrome as a drive-by
- Mix current live squad with another GW’s scores
- Invent a second formation or Match Pos mechanism per competition
