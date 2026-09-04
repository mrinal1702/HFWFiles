# Competition Isolation — What Changed and How to Use It

**Date:** 2026-08-23
**Companion to:** `docs/context/COMPETITION_AUCTION_DATA_ISOLATION.md` (the architecture/spec)

This document records the concrete changes made to move the project from a flat,
single-competition layout to competition-scoped data, and explains how to work
with the new structure day to day.

---

## 1. Why

Scores used to be keyed only on `(player_id, game_week_id)` with no competition
identifier, and data for the EPL, Champions League, and World Cup was mixed in
shared folders (`Matches_Raw/`, `Scores/`, `Player_List/`). That risked one
competition's scores overwriting or leaking into another when gameweek numbers
overlapped. Every score is now scoped to a **competition** and a **round**, and
tagged with the **FotMob match** it came from.

Key rule: a **round is a gameweek**, and every team plays exactly one fixture per
round, so a player's round score **is** their match score — never summed.

---

## 2. New folder layout

```
competitions/
├── active/
│   └── epl-2026-27/                     # English Premier League 2026/27 (active)
│       ├── competition.json             # slug, DB ids, auctions, rounds, GW-id range
│       ├── player-pool/
│       │   ├── master_player_list.csv
│       │   └── squads/                  # per-club squad JSONs
│       └── rounds/
│           └── mw01/
│               ├── round.json           # fixtures + FotMob match ids, states
│               └── matches/
│                   └── <match-slug>/
│                       ├── match.json    # manifest (comp, round, match id, teams)
│                       ├── final-points.csv
│                       └── intermediates/ # raw FotMob JSON + points/keeper CSVs
└── archive/
    ├── world-cup-2026/                  # auctions 5/6/7 (read-only)
    │   ├── records/ scoring-intermediates/ player-pool/ ops/ docs/ tests/
    │   └── _pending-dedup-from-matches-raw/   # leftovers to review vs canonical
    └── uefa-cl-2025-26/                  # RO16 L2 → SF L2 (read-only)
        └── rounds/<round>/ (round.json, matches/, tables/, scores/)
```

Legacy `Matches_Raw/`, `Scores/`, `Player_List/`, and the old top-level
`archive/` were emptied/removed. Their contents were relocated into the tree
above.

### Competition slugs and auctions

| Competition | Slug | DB competition id | Auctions | Legacy GW-id range |
|---|---|---|---|---|
| FIFA World Cup 2026 | `world-cup-2026` | 1 | 5, 6, 7 | 1–99 |
| English Premier League 2026/27 | `epl-2026-27` | 2 | 9 | 100–199 |
| UEFA Champions League 2025/26 | `uefa-cl-2025-26` | 3 | — | 200–299 |

(Auction 8 is a test placeholder and is intentionally not attached.)

---

## 3. Database changes (Supabase)

Run `auction-app/scripts/sql/competition-isolation-migrate-all.sql` once in the
Supabase SQL Editor. It is idempotent and drops no data. It:

- creates `competitions`, `competition_rounds`, `competition_matches`,
  `competition_players`;
- adds `Auctions.competition_id`;
- adds `competition_round_id`, `competition_match_id`, `fotmob_match_id` to
  `Player_Scores`;
- seeds the three competitions, their rounds, and every match (with real FotMob
  match ids);
- attaches auctions (WC 5/6/7 → 1, EPL 9 → 2);
- backfills `competition_round_id` and match tags onto existing scores;
- adds the `unique (competition_round_id, player_id)` key;
- adds `upsert_player_scores_for_round(round_id, rows)` and the
  `player_scores_scoped` view.

The legacy `(player_id, game_week_id)` key is kept and stays valid because
competitions use non-overlapping GW-id ranges (see table above).

Split versions also exist if you prefer to run them in two passes:
`competition-isolation-schema.sql` then `competition-isolation-backfill.sql`.

---

## 4. Vercel app changes

- Match-score display data now lives at
  `auction-app/data/competitions/<slug>/match-scores/`. The EPL CSVs were copied
  there; the legacy `auction-app/data/match-scores/` still exists as a fallback.
- `lib/match-scores/parse-final-points.ts` — `loadMatchScoreCsv(file, slug?)`
  reads the competition-scoped path first and falls back to the legacy path, so
  nothing breaks during the transition.
- `lib/match-scores/sheets.ts` — each sheet now carries `competitionSlug` and
  `fotmobMatchId`.
- `lib/match-scores/types.ts` — `MatchScoreSheet` gained optional
  `competitionSlug` and `fotmobMatchId`.

> Run `npm install && npm run build` in `auction-app/` before deploying to
> confirm the build is clean.

---

## 5. How to add a new match / gameweek

EPL rounds hold 10 fixtures (20 teams); the auction runs 4 gameweeks.

1. Fetch the match: `python Tests/fetch_fotmob_match.py "<fotmob-url>" --score`.
   The FotMob match id comes from `general.matchId` / the manifest.
2. Add it under the round: create
   `competitions/active/epl-2026-27/rounds/<mwNN>/matches/<slug>/` with
   `match.json`, `final-points.csv`, and `intermediates/`.
3. Register it in `round.json` (fixtures + `expected_match_count`) and, for a new
   round, in `competition.json`.
4. Insert it into `competition_matches` (competition_id, round_id,
   fotmob_match_id, slug, teams).
5. Publish scores with the competition-aware RPC so match tags are stamped
   automatically:
   `upsert_player_scores_for_round(<round_id>, '[{"player_id":..,"score":..,"fotmob_match_id":..}, ...]')`.

Partial gameweeks are fine: players who haven't played simply have no score row
yet, so there is nothing to tag until their match is scored.

---

## 6. Still pending

- Update Python tooling defaults (`Tests/fetch_fotmob_match.py`, `procedures/`,
  root `scripts/`) that still point at `Matches_Raw/`, `Scores/`, `Player_List/`.
- Wire `auction-app/scripts/upsert-player-scores-from-finalpoints.mjs` to call
  `upsert_player_scores_for_round` (pass match ids per row).
- Review and dedupe
  `competitions/archive/world-cup-2026/_pending-dedup-from-matches-raw/`.
- Fill World Cup `database_round_id` values in its `competition.json`.
- Confirm the Vercel interface (match-scores, leaderboard, archives) is
  unaffected by the data-path changes.
