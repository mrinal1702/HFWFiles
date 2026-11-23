# Quick Fantasy data

Fixture files only, one folder per real match, keyed by FotMob match id. Game state (lobbies,
bids, squads, results) lives in the `quick` database schema, not here. Nothing in this folder
is read by the main auction app, and nothing here is written into `competitions/`.

```
fixtures/<YYYY-MM-DD>_<home>-<away>_<fotmobMatchId>/      date = kickoff date (UTC)
  fixture.json      match id, clubs + team ids, kickoff (UTC), status open → scored, summary
  players.csv       the biddable pool: player_id, player_name, team_id, team_name, position
  final-points.csv  standard FinalPoints after full time (same columns as the main game)
  scores.csv        one row per pool player: player_id, player_name, team_name, final_score, played
  raw/              FotMob JSON + intermediate CSVs (git-ignored; re-created by scoring)
```

## Commands (run from the repo root)

**1. Before match day: create the fixture from club lists**
```
python quick-fantasy/scoring/build_fixture.py --match-id <FotMob id> --home "Liverpool" --away "Manchester United" --kickoff 2026-12-05T17:30:00+00:00 --players <list.csv> [<list2.csv>]
```
- Lists need columns `player_id, player_name, team_id, team_name, position`, with FotMob ids.
  A competition's `master_player_list.csv` works as-is (it is only read). Rows for other clubs
  are ignored.
- Goalkeepers become one **"<Club> Keepers"** entry per club (id `90000000 + team id`), like the
  main game. Coaches/unknown positions are dropped.
- Re-running refreshes the list; it refuses once the fixture is scored (unless `--force`).

**2. After full time: score it**
```
python quick-fantasy/scoring/score_fixture.py --fixture <FotMob id>            # fetches from FotMob
python quick-fantasy/scoring/score_fixture.py --fixture <FotMob id> --url "<FotMob match url>"
```
Runs the same scoring as `scoring-engine/score_match.py`, writing only into the fixture folder.
It prints anyone who played but wasn't in the player list (nobody could have owned them).

## Fixtures here
| Folder | Note |
|--------|------|
| `2026-08-29_liverpool-nottingham-forest_5795431` | **Test fixture** (past EPL MW2 match, pool from the EPL 26/27 master list) for building/testing the game |
