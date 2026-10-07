@AGENTS.md

# auction-app — the website (Next.js 16 + Supabase, deployed on Vercel)

Two products: **online auction** (`/auctions/*`, live in production) and **live auction**
(`/live-auction/*`, isolated Zoom-auction recorder — never mix its tables with the online ones).

## Participant UI = two fixed surfaces (contracts are law)
| Surface | Routes | Contract | Loaders |
|---|---|---|---|
| **Auction pages** — current squads, budgets, bids | `app/auctions/[auctionId]/{bidding-room,team,bids-held,competitors,transfers,announcements,match-scores,players}` | `docs/ui-contracts/AUCTION_PAGES.md` | `lib/auction-state/` |
| **Leaderboard** — everything scoring | `app/auctions/[auctionId]/leaderboard/**` | `docs/ui-contracts/LEADERBOARD.md` | `lib/scoring/` |

Read the contract before touching a page. Do not change layout, labels or columns unless the
user explicitly asks; a new gameweek is **data only** — follow `docs/GAMEWEEK_RUNBOOK.md`. Run `node scripts/check-gameweek-surfaces.mjs`
after leaderboard/scoring changes.

## Map
| Path | What |
|---|---|
| `app/auctions/[auctionId]/` | In-auction pages (side menu: `app/auctions/_components/AuctionSideNav.tsx`) |
| `app/auction-admin/` | Commissioner admin UI (gated by `Auctions.admin_user_id`) |
| `app/dashboard`, `app/archives`, `app/auction-history` | Post-login shell |
| `lib/auction-state/` | Current-state loaders/rules: dashboard, bidding, bid gates/messages, squad limit, transfers, deadlines |
| `lib/scoring/` | Scoring loaders: leaderboard data, Best XI overlay/display, Match Pos, match-score sheet loader (reads `data/competitions/<slug>/sheets.json`), auction history |
| `lib/` (root) | Shared: Supabase clients, auth, players/users queries, archive status, team names, relegation |
| `data/competitions/<slug>/sheets.json` + `match-scores/` | Match-score manifest + deployed FinalPoints CSVs (Match scores tabs + Match Pos); written by `scoring-engine/score_match.py` |
| `data/best-xi/auction-{id}-gw{legacyGwId}.json` | Deployed formation overlays |
| `scripts/` | Commissioner ops scripts (see `scripts/CLAUDE.md`); `scripts/sql/` = manual SQL + schema index |
| `docs/` | `OPS_INDEX.md` (ops handbook), `ui-contracts/`, `_archive/` (historical — do not follow) |

## Conventions
- Server code uses `createAdminClient()` (`lib/supabase-server.ts`); never import it in client components.
- `export const dynamic = "force-dynamic"` on DB pages; `params` is a Promise — always `await params`.
- Scope every query by `auction_id` / `competition_id`; competition-scoped player names come from
  `competition_players`, never the global `players` table.
- **Player scores are read only via `readPlayerScores()` (`lib/scoring/player-scores.ts`) with the
  auction's gameweek ids** (`getLockedGameWeeksForAuction`). Never look a player up across all
  gameweeks, and never use the global `Game_Weeks.Is_Active` flag — both show other competitions'
  points. `check-gameweek-surfaces.mjs` enforces this.
- Schema changes: manual SQL in `scripts/sql/` + update `scripts/sql/README.md` in the same commit.
- Pushing to `main` deploys production. Active auctions: UCL 2026/27 (10–13) — do not disturb.
