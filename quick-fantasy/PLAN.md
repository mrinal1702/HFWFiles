# Quick Fantasy — notes & plan

_Started 23 Nov 2026. Status: **rules agreed, not built yet.**_

## The idea
A mini version of the HFW auction, on the same HFW website with the same login. Up to 4 friends
log in at the same time, run a 20-minute auction on one real match, then watch the match. The
winner is known straight after full time. "Payout" = the fun of a quick result. **No money, ever.**

One HFW account can have a long-format auction profile **and** a Quick Fantasy profile. The
account and display name/avatar are shared. Points, squads, budgets and games never mix.

## Agreed rules
| Rule | Value |
|------|-------|
| Players per game | 2–4 (host decides; 4 max for now) |
| Fixture | Host picks **one** fixture from a list. Multi-fixture games maybe later |
| Repeat games | Any number of games can run on the same fixture, fully separate from each other |
| Player pool | Both clubs' squads, uploaded in advance (+ one "Keepers" entry per club, like the main game) |
| Budget | **100** each |
| Bids | Opening bid **5**, then raises of **+1** |
| Squad | **Max 5.** All of them score (no "best of", no positions). Buying fewer is allowed, which is a strategy |
| Commitment cap | Players you're leading on + players you've won ≤ 5, **and** those bids added together ≤ 100. No credit is held back for empty slots |
| Empty slots | Score 0. Leftover budget is worth nothing |
| Main clock | **20 minutes** from GO. Hard deadline: bidding stops for everyone |
| Player clock | **2-minute rolling** deadline per player. Every bid resets it to 2:00, never past the main clock |
| Bidding | **All at once.** Anyone can open bidding on any unsold player at any time; many players are live together |
| Latest start | Host can't start a game later than **25 min before kickoff** |
| Screen | **One page** while the game runs: main clock, sortable list of players with current bid, leader and their own countdown, bid button. No separate "my team" pages during the game |
| Not in this game | Transfers, releases, rebuys, gameweeks, formations |
| Winner | Highest squad total. **Tie-break:** compare each tied manager's best player score; if still tied, 2nd best, then 3rd… (an empty slot counts as 0). Joint winners only if every slot is equal |
| Scoring | Commissioner scores the match locally after full time (same HFW scoring) → results appear in every game on that fixture |
| Player lists | Commissioner uploads club lists, or an agent builds them from player data we already have. Every player must carry a **FotMob player id**, because that's how scoring matches players |

## Game flow
1. **Before match day:** the commissioner uploads both clubs' player lists for a fixture. The
   fixture then appears in the fixture list.
2. **Create:** the host picks a fixture and creates a game → gets a join code / link.
3. **Join:** friends (logged in with their normal HFW account) **join** to claim a seat (max 4).
   The lobby shows who's in, live.
4. **Start:** the host clicks **Start game**. Everyone sees **"Game starts in 3… 2… 1… GO"** at the
   same moment.
5. **Auction (20 min):** bid on anything, watch the clocks. When a player's 2-min clock runs out,
   the highest bidder gets them. At 20:00 everything still open goes to its high bidder.
6. **Squads locked:** results page shows all squads.
7. **Match:** after full time the commissioner scores the match → totals and the winner appear.

## Where it lives: same site, same login, separate data
**Decision: one Supabase project (the existing one), with Quick Fantasy in its own `quick` schema.**

A separate Supabase project can't share the HFW login cleanly, because users belong to one
project. So the dividing line is a schema inside the same project.

| Shared (read-only from Quick Fantasy) | Quick Fantasy only (`quick` schema) |
|---|---|
| `auth.users` (the login itself) | fixtures, fixture players, fixture scores |
| `public.profiles` (display name, avatar) | games, seats, lots, bids, squads, results |
| The website shell (header, login, Vercel project) | its own pages under `/quick` |

How the separation is guaranteed:
- Every Quick Fantasy table and function lives in `quick.*`. Nothing in `quick` reads or writes
  any `public` auction table (`Auctions`, `auction_*`, `Player_Scores`, `players`,
  `gameweek_squads`, `competitions`, `auction_leaderboard`…), and no main-game code reads `quick`.
- The only links out of `quick` are `user_id → auth.users(id)` (and reading `profiles` for names).
- No shared ids: Quick Fantasy has its own fixture/player tables keyed by FotMob ids, not the
  main `players` table, so a club or player existing in both games can never collide.
- Every Quick Fantasy SQL file only creates or changes `quick.*` objects. Before/after checks on
  UCL auctions 10–13 are run for every migration (same rule as any other change).
- Row-level security on every `quick` table: you can read games you're seated in (and the lobby
  of games you're joining). All writes go through `quick.*` functions, never direct table writes.

### Load: is this too much for Vercel / Supabase free plans? No.
- **Bids skip Vercel entirely.** The browser calls the `quick.place_bid` database function and
  listens for updates straight from Supabase. Vercel just serves the page.
- **Clocks cost nothing.** The database stores *when* things end (`go_at`, `hard_end_at`, each
  lot's `ends_at`). Every browser counts down locally, corrected for its own clock offset to
  the server. No ticking traffic, and a page refresh can't break it.
- **Realtime:** Supabase pushes each new bid to everyone (normally well under a second). Free tier
  limits (200 concurrent connections, 2M messages/month) are far above a few 4-person games.
- A busy game is a few hundred bids in 20 minutes, which is tiny next to the main site's normal
  traffic. The main site doesn't get slower.
- Shared risk to know about: one database means a Supabase outage hits both games. That is
  already true for the main site today.

### Closing lots
There is no background timer. Every bid, and every browser when a clock hits 0, calls
`quick.settle_expired`, which closes any lot whose time has passed. The server decides the
winner, so a late or forged bid can't win.

## Database (`quick` schema)
| Table | Role |
|-------|------|
| `fixtures` | One per real match: FotMob match id, clubs, kickoff, status (open / scored) |
| `fixture_players` | Uploaded pool per fixture (FotMob player id, name, club) |
| `fixture_scores` | FinalPoints rows once the match is scored |
| `games` | One quick game: fixture, host, join code, max seats, status (lobby / countdown / live / locked / final), `go_at`, `hard_end_at` |
| `game_seats` | Who joined (user id → `auth.users`) |
| `game_lots` | One row per player bid on: high bid, leader, `ends_at`, status (live / sold) |
| `game_bids` | Append-only bid log |
| `game_results` | Each manager's total, rank and tie-break detail, written after scoring |
| `profiles` _(view/columns later)_ | Quick Fantasy career stats (games played, wins) for the user's quick profile |

Functions (new; the main game's bidding rules are different):
- `quick.create_game`, `quick.join_game`, `quick.start_game`. Start is host-only, ≥ 2 seats,
  ≥ 25 min before kickoff; it sets `go_at` = now + 4s and `hard_end_at` = `go_at` + 20 min.
- `quick.place_bid` checks the game is live, the lot is open, the bid is ≥ 5 (new) or ≥ high + 1,
  you'd be within 5 players, and your committed total ≤ 100 (players won + players you lead,
  this bid included). Then it sets `ends_at` = min(now + 2 min, `hard_end_at`).
- `quick.settle_expired` closes lots whose clock ran out and locks the game at the hard end.
- `quick.compute_results` totals squads from `fixture_scores`, applies the tie-break and ranks.

## Code & files
| Where | What |
|-------|------|
| `quick-fantasy/` | Plan, SQL for the `quick` schema, scoring wrapper, fixture data files |
| `auction-app/app/quick/…`, `auction-app/lib/quick/…` | The pages and code. They have to live in the website's folder to share the site and login. Self-contained: no imports from main-game auction/leaderboard code except login/profile helpers |

Fixture files (uploaded lists + scoring output) are described in
[`data/README.md`](./data/README.md). Game data lives only in the database.

## Build phases
| # | Phase | Done when |
|---|-------|-----------|
| 1 ✅ | Fixture data: player-list format + scoring wrapper into `quick-fantasy/data/` | Done 23 Nov 2026: Liverpool v Forest (EPL MW2) scored byte-identical to `score_match.py`, zero changes outside `quick-fantasy/` |
| 2 | `quick` schema, tables, row-level security, fixture upload script | A fixture and its players are in `quick.*`; before/after check shows UCL 10–13 untouched |
| 3 | Game functions (create / join / start / bid / settle / results) + tests | A simulated 4-person auction settles correctly, including bids racing the clock and tie-breaks |
| 4 | `/quick` pages: fixture list, lobby, 3-2-1 countdown, one-page auction room, squads/results, quick profile | 4 browsers play a full game against a past match (preview deploy first) |
| 5 | Live dry run on a real PL fixture | Bids before kickoff, winner shown after full time |
| 6 | (Later) Solo vs bots, multi-fixture games, more than 4 players | — |

## Phase 1 notes
- Scoring follows today's engine, so re-scoring an old match can differ from its archived
  FinalPoints. In the test match, 3 players' scoring roles changed after a later engine update.
  Quick Fantasy always scores with the current engine, and that's expected.
- Player lists must be current. In the test match, 3 players who played weren't in the August
  EPL pool (club moves). For real fixtures, upload fresh club lists close to match day.

## Still to hash out
- **Quick profile:** what it shows (games played, wins, best squad, history?) and where it sits
  next to the existing public profile. It can be decided in phase 4.
- **Navigation:** how users switch between long auctions and Quick Fantasy on the site
  (a header tab / dashboard card). This touches the shared site shell, so preview first.
