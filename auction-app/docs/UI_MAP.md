# UI work — start here (participant interface)

For UI sessions, read **only** this file + the contract for the surface you're changing.
Skip `competitions/`, `scoring-engine/`, `formation-engine/`, `positions/`, `data/`, `scripts/`,
`docs/_archive/` — they are data/ops and never needed for a visual change.

## Read first
| What | File |
|---|---|
| Auction pages rules (menu order, labels, columns) | `docs/ui-contracts/AUCTION_PAGES.md` |
| Leaderboard rules | `docs/ui-contracts/LEADERBOARD.md` |
| Next.js 16 caveats | `AGENTS.md` (check `node_modules/next/dist/docs/` before using unfamiliar APIs) |

## Styling foundations (change these for app-wide look)
| What | File |
|---|---|
| Tailwind v4 entry, colour tokens, page backdrop (mid-blue + glows + pitch stripes), display headings, mobile zoom | `app/globals.css` |
| Fonts: Geist (body), **Barlow Semi Condensed** = `font-display` (titles, player / manager / team names) | `app/layout.tsx` |
| Position colours (GK/DEF/MID/FWD, Flexible, Bench) | `app/auctions/_components/position-theme.tsx` |
| Root shell, fonts (Geist), `<body>` classes | `app/layout.tsx` |
| In-auction shell (side nav + header + budget strip) | `app/auctions/[auctionId]/layout.tsx` |
| Side menu | `app/auctions/_components/AuctionSideNav.tsx` |
| Top nav outside auctions | `app/_components/ParticipantNav.tsx` |
| Avatars / manager chips | `app/_components/entity/` |

## Pages (route → file)
All under `app/auctions/[auctionId]/` unless noted. Shared pieces live in `app/auctions/_components/`.

| Menu item | Route | Page | Key components |
|---|---|---|---|
| Bidding room | `/bidding-room` | `bidding-room/page.tsx` | `_components/BiddingRoomClient.tsx`, `BidRowForm.tsx`, `AuctionDeadlines.tsx`, `FixturesModalButton.tsx` |
| My team | `/team` | `team/page.tsx` | `team/_components/ReleaseButton.tsx`, `RosterSlotCounts.tsx` |
| Announcements | `/announcements` | `announcements/page.tsx` | `announcements/_components/*` |
| Competitors – Bidding | `/competitors` | `competitors/page.tsx`, `competitors/[auctionUserId]/page.tsx` | `_components/CompetitorsAuctionList.tsx` |
| Bids held | `/bids-held` | `bids-held/page.tsx` | — |
| Transfer Room | `/transfers` | `transfers/page.tsx`, `new/`, `[transferId]/respond/` | `transfers/_components/TransferCard.tsx` |
| Match scores | `/match-scores` | `match-scores/page.tsx` | `app/scores/_components/MatchScoresTable.tsx`, `ScoresTabs.tsx` |
| Leaderboard | `/leaderboard` | `leaderboard/page.tsx` | `leaderboard/_components/*` (StandingsTable, GwPointsView, GwSquadTable…) |
| Player detail | `/players/[playerId]` | `players/[playerId]/page.tsx` | — |
| Landing page | `/` | `app/page.tsx` (hero, step copy in `STEPS`, Sign up / Log in card) | `app/_components/HowItWorksCarousel.tsx` (one card at a time on all screens, auto-slides every 10s, arrows on `sm+`) |
| Dashboard (post-login) | `/dashboard` | `app/dashboard/page.tsx` | `JoinAuctionForm.tsx`, `ProfileAvatar.tsx`, `app/_components/TrophyCabinet.tsx` |
| Login / signup / password reset | `/login`, `/signup`, `/forgot-password`, `/reset-password` | `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx` | `app/_components/AuthShell.tsx` (navy header card + logo, `AuthField` with optional InfoTip, `AuthError`, footer pills) |

Data loaders (`lib/auction-state/`, `lib/scoring/`) feed these pages — a purely visual change
should not need to touch them.

## Previewing locally
- Dev server: `npm run dev` in `auction-app/` → http://localhost:3000 (launch config "auction-app" in repo-root `.claude/launch.json`).
- **Local dev talks to the production Supabase** (`.env.local`). Browsing is safe; *submitting*
  bids, releases, transfers or team-name changes locally writes to the live UCL auctions (10–13).
  Look, don't click actions.
- Work on a branch (`ui/*`); Vercel builds a preview URL for pushed branches. Merging to `main` deploys production.
- Don't run `npm run build` while relying on the dev preview — both write `.next` and the dev server can start
  returning false 404s; restart the dev server if that happens.

## Shared UI pieces (reuse — don't fork)
| Piece | Used by |
|---|---|
| `app/_components/AuctionCard.tsx` | Active Auctions, Archives, Auction History cards |
| `app/_components/InfoTip.tsx` | All "i" info icons (hover desktop / tap phone) |
| `app/auctions/_components/position-theme.tsx` | Position / Flexible / Bench colours + `PositionPill` |
| `app/auctions/_components/SquadByPosition.tsx` | My team, competitor team |
| `app/auctions/_components/LeadingBidsList.tsx` | Bids held, competitor "Bids Held by …" |
| `app/auctions/[auctionId]/leaderboard/_components/PointsManagerChip.tsx` | Every manager link on the Leaderboard |
| `app/auctions/[auctionId]/transfers/_components/TransferHistoryCard.tsx` (`DealLeg`) | Transfer history + in-progress deal cards |

Visual theme and linking rules: **Visual theme** / **Linking rules** in `docs/OPS_UI_SURFACES.md`.
