# HFW Auction App — Agent Handoff Document

Last updated: July 2026

> **IMPORTANT — HFW = "How Football Works"** (not "Half Full Whistle" or any other expansion). Do not get this wrong.

This document is written for an AI agent picking up this project. Read it fully before making any changes.

---

## Operations handbook (start here for live auctions)

**Day-to-day / gameweek / scoring / relegations / UI standards:**  
→ **[`OPS_INDEX.md`](./OPS_INDEX.md)** and the `OPS_*.md` docs linked from it.

**Leaderboard UI (frozen contract):**  
→ **[`ui-contracts/LEADERBOARD.md`](./ui-contracts/LEADERBOARD.md)** — do not change Standings / My Points / Competitors layout unless the user explicitly asks.

Do **not** improvise one-off procedures when an OPS doc and script already exist. Tournament archives live under `archive/world-cup-2026/` (historical only).

---

## What this project is

**HFW stands for "How Football Works".**

**HFW Auction** is a fantasy football auction app for a private group of friends. Players are auctioned off and each participant builds a squad of real-world football players, who then earn points based on their real-life performances in matches (Champions League, World Cup, etc.).

The app has two distinct auction modes:

### 1. Online Auction (`/auctions/*`) — already built, live in production

An asynchronous online bidding system. Participants place bids on players through the app over a rolling time window. Built and working. Do not break this.

### 2. Live Auction (`/live-auction/*`) — fully built, UI redesigned May 2026

A real-time tracking interface for verbal auctions conducted on Zoom or in person. Bidding happens offline (verbally) — the app is only used by an admin/auctioneer to record completed sales, and by participants to view squads and budgets live. **This module is fully isolated from the online auction pipeline.**

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth via `@supabase/ssr` |
| Hosting | Vercel — root directory must be `auction-app/` |
| Styling | Tailwind CSS v4 |
| Schema management | Manual SQL scripts run in Supabase SQL Editor (no formal migrations) |

**Live URL:** https://hfwauction.vercel.app

**Supabase project:** `ealowpaiiwsrbwucgkng.supabase.co`

---

## Repository structure

```
HFWFiles/                          ← git repo root
├── auction-app/                   ← Next.js app (Vercel root dir)
│   ├── app/                       ← App Router pages
│   │   ├── auctions/              ← Online auction (DO NOT BREAK)
│   │   ├── live-auction/          ← Live auction module
│   │   │   ├── [auctionId]/
│   │   │   │   ├── _components/
│   │   │   │   │   └── AuctionTabs.tsx       ← Tabbed participant view (client)
│   │   │   │   ├── admin/
│   │   │   │   │   ├── _components/
│   │   │   │   │   │   ├── AdminSaleSection.tsx  ← Mode toggle wrapper (client)
│   │   │   │   │   │   ├── SaleForm.tsx          ← Search mode with player + participant comboboxes (client)
│   │   │   │   │   │   ├── SalesLog.tsx          ← Sales log with void/edit (client)
│   │   │   │   │   │   ├── TeamBrowseForm.tsx    ← Browse-by-team mode (client)
│   │   │   │   │   │   └── UndoLastSale.tsx      ← One-click void of most recent sale (client)
│   │   │   │   │   ├── actions.ts            ← Server actions: record/void/edit/markUnsold
│   │   │   │   │   └── page.tsx              ← Admin page (server)
│   │   │   │   ├── team/[participantId]/
│   │   │   │   │   └── page.tsx              ← Squad page (server)
│   │   │   │   ├── layout.tsx                ← Auction header + auth guard
│   │   │   │   └── page.tsx                  ← Participant overview (server → AuctionTabs)
│   │   │   ├── layout.tsx                    ← Live auction auth guard
│   │   │   └── page.tsx                      ← Auction list
│   │   ├── dashboard/             ← User dashboard (join by code)
│   │   ├── login/ signup/         ← Auth pages
│   │   └── api/health/            ← Health check endpoint
│   ├── lib/                       ← Shared server utilities
│   │   ├── supabase-server.ts     ← createAdminClient() — service role
│   │   ├── supabase/browser.ts    ← Browser Supabase client
│   │   ├── supabase/server.ts     ← Server Supabase client (cookie-based)
│   │   ├── auth/get-user.ts       ← getAuthUser() helper
│   │   ├── live-auction-types.ts  ← TypeScript types for live auction
│   │   └── live-auction-data.ts   ← Server data loaders for live auction
│   ├── scripts/                   ← Node.js maintenance scripts (.mjs)
│   │   ├── sql/                   ← SQL files (run manually in Supabase)
│   │   └── seed-live-auction-players.mjs ← Seeds players into live auction
│   ├── docs/                      ← All project documentation (here)
│   ├── middleware.ts              ← Route auth guard
│   └── .env.local                 ← Local env vars (not committed)
├── Matches_Raw/                   ← Raw match data (CSV/JSON from FotMob)
├── Tests/                         ← Python scoring scripts
├── procedures/                    ← Python helper procedures
└── scripts/                       ← Python pipeline scripts
```

---

## Environment variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://ealowpaiiwsrbwucgkng.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key — find in Supabase Dashboard → Settings → API Keys>
SUPABASE_SERVICE_ROLE_KEY=<secret key — find in Supabase Dashboard → Settings → API Keys>
AUCTION_LAB_AUCTION_ID=3
```

**Note on key format:** These use Supabase's new `sb_publishable_*` / `sb_secret_*` key format. These do NOT work as raw curl headers — always use the official `@supabase/supabase-js` SDK. The GitHub Actions keepalive workflow (`/.github/workflows/keepalive-supabase.yml`) uses Node 22 + SDK for this reason.

---

## Data access conventions

**Always follow these patterns or you will break things:**

1. **Server Components, Server Actions, API Routes** → use `createAdminClient()` from `lib/supabase-server.ts` (service role, bypasses RLS)
2. **Auth checks** → use `getAuthUser()` from `lib/auth/get-user.ts` — returns `User | null`
3. **Client Components** → never import `supabase-server.ts` — only use the browser client if needed
4. **No RLS reliance** — the app relies on server-side auth checks, not database RLS policies
5. **Schema changes** → write a SQL file in `scripts/sql/` and run it in Supabase SQL Editor. No ORM, no formal migrations.

---

## Database: Online Auction tables (existing — DO NOT MODIFY)

| Table | Purpose |
|-------|---------|
| `"Auctions"` | Main auction events (note: capital A, quoted) |
| `auction_users` | Participants per auction |
| `auction_lots` | Player lots with bidding status |
| `auction_bids` | All bids (append-only) |
| `auction_teams` | Finalised squad assignments |
| `players` | Master player list (from FotMob data) |
| `profiles` | Auth user profiles (display_name) |
| `"Game_Weeks"` | Gameweek definitions |
| `player_scores` / `"Player_Scores"` | Scoring data |

Key RPCs: `place_bid`, `finalize_auction_hard_deadline`, `finalize_expired_lots`.

**`players.player_id` = FotMob player ID** (integer, e.g. 776151). This is the critical external identifier used to link players across systems.

---

## Database: Live Auction tables

All four tables created by `scripts/sql/live-auction-schema.sql`.

| Table | Purpose |
|-------|---------|
| `live_auctions` | One row per live auction event |
| `live_auction_participants` | Participants; `role = 'admin'` = auctioneer |
| `live_auction_players` | Player pool for the auction (seeded from `players` table) |
| `live_auction_sales` | Completed sales — the sole source of truth |

**Design principle:** Squads and budgets are always computed from `live_auction_sales` — never stored separately. Budget remaining = `starting_budget - SUM(non-voided sale prices for that participant)`.

**`live_auction_players.fotmob_player_id`** (text) = matches `players.player_id` (integer, cast to string). This is the bridge for future pipeline import.

**Admin/participant dual role:** A person with `role = 'admin'` in `live_auction_participants` is simultaneously the auctioneer AND a participant. They appear in "My Team", have a budget, and can be assigned players — while also having full access to the admin recording panel. The schema enforces `UNIQUE(auction_id, user_id)` so one row per person per auction.

---

## Live Auction routes

| Route | Who can access | What it does |
|-------|---------------|-------------|
| `/live-auction` | Any logged-in user | Lists all live auctions with status badges |
| `/live-auction/[auctionId]` | Any participant | Tabbed view: My Team / All Teams / Unsold Players + Refresh button |
| `/live-auction/[auctionId]/team/[participantId]` | Any logged-in user | Full squad page: position groups sorted by price desc, budget bar |
| `/live-auction/[auctionId]/admin` | Admin role only | Record sales (Search or Browse-by-team), budget view, sales log with void/edit |

**Admin access:** Checked server-side via `live_auction_participants WHERE auction_id = X AND user_id = auth_user_id AND role = 'admin'`. Redirects to overview if check fails.

---

## Live Auction: participant overview tabs (`AuctionTabs.tsx`)

The overview page is a server component that fetches all data in parallel, then passes it to `AuctionTabs` (a client component) for tab switching. Data is never re-fetched on tab switch — all three tabs receive their data as props on initial load.

**My Team tab:** Budget progress bar + slots remaining. Below the bar: **avg spend per remaining slot** (`budget_remaining / slots_left`, 2dp) — helps participants plan their spend. Squad grouped GK → DEF → MID → FWD, sorted by price descending within each group. Shows "not a participant" message if the logged-in user has no participant row.

**All Teams tab:** One card per participant. Each card shows budget bar, `N GK · N DEF · N MID · N FWD` breakdown, and **avg spend per remaining slot** for that participant. Clicking a card navigates to `/team/[participantId]`.

**Unsold Players tab:** All players with status `available` or `unsold` (no distinction shown), grouped by team name alphabetically, with a total count header.

**Refresh button:** Calls `router.refresh()` — triggers a server-side re-render with fresh data. No polling; manual only.

---

## Live Auction: admin page (`admin/page.tsx`)

### Undo last sale (`UndoLastSale.tsx`)
An amber banner at the top of the admin page showing the most recent non-voided sale. A single **↩ Undo** button immediately voids it (no confirmation step) and restores the player to available. Disappears when there are no non-voided sales. Designed for instant error correction mid-auction.

### Record a Sale — two modes (toggled via `AdminSaleSection.tsx`)

**Search player mode (default):** Free-text combobox searches all available players by name/team. Select player → **search-as-you-type participant combobox** (type "Con" → Conrad appears) → enter price → Confirm Sale. Both player and participant fields show a chip once selected with a Clear button.

**Browse by team mode:** Dropdown selects a team. Shows the full player list for that team:
- Available players: inline owner `<select>` + price `<input>` + Sell button per row.
- Sold players: greyed row showing owner + price + ✓ Sold badge + Edit button (opens inline edit form).
- Passed/unsold players: greyed with strikethrough.

### Budget table
Read-only server component showing all participants' current remaining budgets. **Computed from `getParticipantSummaries` which fetches all non-voided sales with no row limit** — accurate regardless of total sale count. Re-renders on every server action via `revalidatePath`.

### Sales log (`SalesLog.tsx`)
Last 30 sales (including voided). Each non-voided row has Edit and Void buttons that open inline panels. Void requires optional reason text.

---

## Live Auction: validation rules

Implemented in `app/live-auction/[auctionId]/admin/actions.ts`.

**Hard blocks — `recordSaleAction` (reject sale entirely):**
- Missing or non-numeric price
- Price is not a whole number (decimals rejected server-side via `Number.isInteger`)
- Price < `auction.min_bid` (default £5) — checked after auction config is loaded
- Player not found in this auction or not `available`
- Duplicate non-voided sale for this player
- Participant not found in this auction
- Participant already has `auction.squad_size` players (default 18) — full squad hard block
- Price > participant's `budget_remaining` — budget never goes negative

**Hard blocks — `editSaleAction`:**
- Price is not a whole number
- Price < `auction.min_bid`
- If participant is changing: new participant already has a full squad
- New price > new participant's budget (excluding this sale from the calculation)

**`markUnsoldAction` guards:**
- Rejects if player is already `sold` (must void the sale first)
- Rejects if player is already `unsold`
- Revalidates both the admin page and participant overview on success

**There is no soft warning.** The reserve check (budget after purchase vs. min spend for remaining slots) was removed — participants track their own spend using the avg-per-slot stat visible on the overview page.

**Void:** Sets `is_voided = true`, restores player status to `available`. Revalidates admin + overview pages.

**Edit:** Re-runs budget and min_bid checks excluding the edited sale, then updates price/participant in place.

---

## Live Auction: data functions (`lib/live-auction-data.ts`)

| Function | Purpose |
|----------|---------|
| `getLiveAuctions()` | All live auction rows |
| `getLiveAuction(id)` | Single auction by ID |
| `getLiveAuctionParticipants(id)` | All participants for an auction |
| `getParticipantSummaries(id, budget)` | Participants with total_spent + budget_remaining + players_count |
| `getParticipantSummariesWithPositions(id, budget)` | Above + per-position player counts (GK/DEF/MID/FWD) |
| `getParticipantPositionBreakdowns(id)` | Map of participantId → PositionBreakdown |
| `getRecentSales(id, limit)` | Sales with player + participant names; includes voided |
| `getRecentSalesPublic(id, limit)` | Non-voided sales only |
| `getAvailablePlayers(id)` | Players with status = available |
| `getAllPlayersWithSaleInfo(id)` | All players joined with their active sale (for admin team browse) |
| `getUnsoldPlayers(id)` | Players with status = available or unsold (for Unsold tab) |
| `getParticipantSquad(id, participantId)` | Non-voided sales as SquadPlayer array |
| `getParticipantByUserId(id, userId)` | Participant row for the logged-in user |
| `getParticipantById(participantId)` | Participant row by participant ID |

Position categorisation (`categorizePosition`) lives at the top of `live-auction-data.ts` and is also inlined in client components (`AuctionTabs.tsx`, squad page) since `live-auction-data.ts` is server-only.

---

## Live Auction: TypeScript types (`lib/live-auction-types.ts`)

Key types beyond the raw DB shapes:

| Type | Purpose |
|------|---------|
| `ParticipantSummary` | Participant + total_spent + budget_remaining + players_count |
| `PositionBreakdown` | `{ gk, def, mid, fwd, other }` counts |
| `ParticipantSummaryWithPositions` | ParticipantSummary + positions: PositionBreakdown |
| `PlayerWithSaleInfo` | LiveAuctionPlayer + sale_id / sale_price / sold_to_name / sold_to_participant_id (null if unsold) |
| `SaleWithDetails` | Sale row + player_name + participant_name |
| `SquadPlayer` | Joined sale + player data for squad display |

---

## Live Auction: current test data

As of May 2026 there is one test auction in the database:

| Field | Value |
|-------|-------|
| Auction name | HFW World Cup 2026 Auction Test |
| Auction ID | `e4223881-987b-483b-9681-817d47b0b94a` |
| Status | setup |
| Budget | £350 |
| Squad size | 18 |
| Min bid | £5 |
| Admin participant | Mrinal (`trivedi.mrinal.dinesh@gmail.com`, user_id `785ab229-1c9e-4208-b20f-76506968d4be`) |
| Players seeded | 82 (Arsenal 26, Barcelona 28, Real Madrid 28) |

**Note:** This is a test auction with club squads. The actual World Cup 2026 auction will be a new `live_auctions` row with national team squads.

---

## Adding participants to a live auction

No UI exists for this yet. Use the Supabase SQL Editor:

```sql
-- Step 1: find the user's UUID (look up by email in Authentication → Users)
-- Step 2: insert the participant row
INSERT INTO live_auction_participants (auction_id, user_id, display_name, role)
VALUES (
  '<auction_uuid>',
  '<auth_user_uuid>',
  'Display Name',
  'participant'   -- or 'admin'
);
```

If the person hasn't signed up yet, create their account first via Supabase Dashboard → Authentication → Users → Add user, then use the UUID from that.

---

## Seeding players into a live auction

```bash
node scripts/seed-live-auction-players.mjs \
  --auction-id <uuid> \
  --teams "Brazil,England,Argentina,Germany"
```

- Copies from the `players` table, filters by `team_name`
- Upserts on `(auction_id, fotmob_player_id)` — safe to run multiple times
- Does NOT reset players already marked `sold` or `unsold`
- Use `--dry-run` to preview without writing

**Important:** The `players` table currently contains club squads (Arsenal, Barcelona, Real Madrid). Before the actual World Cup auction, it needs to be refreshed with national team squads.

---

## Feature documentation

| Doc | What it covers |
|-----|---------------|
| `docs/GAMEWEEK_FLOW.md` | Full GW cycle: bidding windows, snapshots, budget boost, commissioner ops checklist |
| `docs/PLAYER_RELEASE_SYSTEM.md` | Release types (paid/free), GW windows, refund logic, DB schema, RPC, commissioner SQL ops |
| `docs/LIVE_AUCTION_COMMISSIONER_GUIDE.md` | Live auction setup, seeding, admin workflow, troubleshooting |
| `docs/BIDDING_SYSTEM_AND_UI_HANDOFF.md` | Online auction bidding flow, deadlines, budget columns |
| `docs/TESTING_OPERATIONS.md` | Reset/seed scripts, multi-auction test setup |

---

## What is NOT built yet (planned next steps)

1. **UI to add/manage participants** — currently done via SQL (see above)
2. **UI to create a live auction** — currently done manually in Supabase
3. **UI to add players to the pool** — currently done via seed script
4. **"Mark as unsold" button** in the Browse-by-team view — `markUnsoldAction` exists in `actions.ts` but has no UI button wired in the browse mode rows
5. **Forgot password page** — password resets are done manually via Supabase Dashboard → Authentication → Users → Send password reset email
6. **Link to live auction from the main dashboard** — not yet added
7. **Transfer/import** of live auction squads into the main online auction pipeline
8. **Scoring** for live auction squads
9. **World Cup national team player list** — `players` table needs refreshing before the actual live auction
10. **"Last sale" feed on the participant overview** — nice-to-have; participants currently see updates only after a manual Refresh

---

## GitHub Actions

One workflow: `.github/workflows/keepalive-supabase.yml`

Runs every 12 hours to ping the Supabase project (free tier pauses after inactivity). Uses Node 22 + `@supabase/supabase-js` SDK (required for the `sb_publishable_*` key format). Can also be triggered manually via GitHub Actions UI.

---

## Key conventions

- `export const dynamic = "force-dynamic"` on every page that reads from the database
- `params` in Next.js 16 is a `Promise<{ ... }>` — always `await params`
- Auction IDs for live auction are **UUIDs** (not integers like the old `"Auctions"` table)
- Always use `createAdminClient()` for server-side data access
- Never import `server-only` modules from client components
- Tailwind colours: `slate` for text/borders, `sky` for links/highlights, `red` for errors, `amber` for warnings, `green` for success
- Card style: `rounded-xl border border-sky-100 bg-white p-5 shadow-sm`
- Commit directly to `main` — Vercel deploys automatically on push
