# Quick Fantasy (`quick-fantasy/`) — agent guide

A **separate, short-form game** on the same HFW site and login: 2–4 friends run a 20-minute
auction on one real Premier League match (budget 100, max 5 players, 2-minute rolling clocks),
then the winner is shown after full time. Full rules and build plan: [`PLAN.md`](./PLAN.md).

## Isolation rules (hard)
- **Same Supabase project, own schema.** All Quick Fantasy tables and functions live in the
  `quick` schema. The only things shared with the main game are the login (`auth.users`) and
  `public.profiles` (display name/avatar), and both are **read-only** from here.
- **Never read or write main-game tables** (`Auctions`, `auction_*`, `Player_Scores`, `players`,
  `gameweek_squads`, `competitions`, `auction_leaderboard`, …) from Quick Fantasy code or SQL,
  and never make main-game code read `quick.*`.
- Every SQL file here may only create/alter `quick.*` objects. Run before/after checks on the
  active UCL auctions (10–13) around every migration. They must not change.
- **Scoring engine is read-only from here.** Call `../scoring-engine/` functions, but do **not**
  use `score_match.py` (it registers matches in `competitions/` and the app's `sheets.json`). Use
  `quick-fantasy/scoring/score_fixture.py`, which writes only under `quick-fantasy/data/`.
  Point weights are never forked here; Quick Fantasy scores exactly like the main game.
- Website code lives in `auction-app/app/quick/` and `auction-app/lib/quick/` (it must, to share
  the site and login). Keep it self-contained: only login/profile helpers may be imported from
  the main app.

## Layout
| Path | Role |
|------|------|
| `PLAN.md` | Rules, flow, architecture, build phases, open items |
| `data/` | Per-fixture files (uploaded player lists, FotMob JSON, FinalPoints). See `data/README.md` |
| `scoring/` | `build_fixture.py` (club lists → fixture), `score_fixture.py` (FotMob → FinalPoints + `scores.csv`, calling `../scoring-engine/`). Commands in `data/README.md` |
| `db/` | (planned) SQL for the `quick` schema: tables, RLS, functions, tests |
