# HFW Auction App — Agent Handoff Document

Last updated: May 2026

This document is written for an AI agent picking up this project. Read it fully before making any changes.

---

## What this project is

**HFW (Half Full Whistle) Auction** is a fantasy football auction app for a private group of friends. Players are auctioned off and each participant builds a squad of real-world football players, who then earn points based on their real-life performances in matches (Champions League, World Cup, etc.).

The app has two distinct auction modes:

### 1. Online Auction (`/auctions/*`) — already built, live in production

An asynchronous online bidding system. Participants place bids on players through the app over a rolling time window. Built and working. Do not break this.

### 2. Live Auction (`/live-auction/*`) — newly built, MVP complete

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
│   │   ├── live-auction/          ← Live auction module (newly built)
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

## Database: Live Auction tables (newly built)

All four tables created by `scripts/sql/live-auction-schema.sql`.

| Table | Purpose |
|-------|---------|
| `live_auctions` | One row per live auction event |
| `live_auction_participants` | Participants; `role = 'admin'` = auctioneer |
| `live_auction_players` | Player pool for the auction (seeded from `players` table) |
| `live_auction_sales` | Completed sales — the sole source of truth |

**Design principle:** Squads and budgets are always computed from `live_auction_sales` — never stored separately. Budget remaining = `starting_budget - SUM(non-voided sale prices for that participant)`.

**`live_auction_players.fotmob_player_id`** (text) = matches `players.player_id` (integer, cast to string). This is the bridge for future pipeline import.

---

## Live Auction routes

| Route | Who can access | What it does |
|-------|---------------|-------------|
| `/live-auction` | Any logged-in user | Lists all live auctions |
| `/live-auction/[auctionId]` | Any participant | Overview: budgets, participants, recent sales |
| `/live-auction/[auctionId]/team/[participantId]` | Any logged-in user | Participant's squad grouped by position |
| `/live-auction/[auctionId]/admin` | Admin role only | Record/void/edit sales, live budget view |

**Admin access:** Checked via `live_auction_participants.role = 'admin'` for the logged-in user's `user_id`. Redirect to overview if not admin.

---

## Live Auction: validation rules

Implemented in `app/live-auction/[auctionId]/admin/actions.ts`.

**Hard blocks (reject sale):**
- Player not found or not `available`
- Duplicate non-voided sale for this player
- Participant not found in this auction
- Price > budget remaining for participant

**Soft warning (admin must acknowledge with checkbox):**
- After purchase, participant's remaining budget < (slots left × min_bid)
- Admin can override — it's their strategic choice

**Void:** Sets `is_voided = true`, restores player status to `available`.

**Edit:** Re-runs budget check excluding the edited sale, then updates price/participant in place.

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
| Admin participant | Mrinal (`trivedi.mrinal.dinesh@gmail.com`) |
| Players seeded | 82 (Arsenal 26, Barcelona 28, Real Madrid 28) |

**Admin login:** `trivedi.mrinal.dinesh@gmail.com` / `HFW2026temp!` (change this)

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

Note: The current `players` table contains club squads (Arsenal, Barcelona, Real Madrid, etc.). Before the actual World Cup auction, the player list will be refreshed with national team squads.

---

## Adding participants to a live auction

There is currently no UI for this — do it via Node script using the service role key:

```javascript
const { createClient } = require('@supabase/supabase-js');
// ... load env
const sb = createClient(url, key);

// Create account if needed
const { data } = await sb.auth.admin.createUser({
  email: 'user@example.com',
  password: 'TempPass123!',
  email_confirm: true,
  user_metadata: { display_name: 'DisplayName' }
});

// Add as participant
await sb.from('live_auction_participants').insert({
  auction_id: '<auction_id>',
  user_id: data.user.id,
  display_name: 'DisplayName',
  role: 'participant'  // or 'admin'
});
```

---

## What is NOT built yet (planned next steps)

1. **UI to add/manage participants** in a live auction (currently done via script)
2. **UI to create a live auction** (currently done manually in Supabase)
3. **UI to add players to the pool** (currently done via seed script)
4. **Marking a player as unsold via UI** (action exists, UI button not added)
5. **Refresh button / auto-refresh** on the overview page (currently manual browser refresh)
6. **Link to live auction from the main dashboard** (not yet added)
7. **Transfer/import** of live auction squads into the main online auction pipeline
8. **Scoring** for live auction squads
9. **World Cup national team player list** — the `players` table needs refreshing before the actual live auction; it currently contains club squads from the CL season

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
