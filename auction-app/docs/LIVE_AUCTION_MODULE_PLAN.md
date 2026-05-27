# Live Auction Module — MVP Plan

## What this is

A separate, standalone tracking interface for **live verbal auctions** (Zoom or in-person).
Bidding happens offline — the admin simply records completed sales. Participants view their squad and budget in real time by refreshing.

This module is **isolated from the existing online bidding pipeline** (`/auctions/*`). No integration until explicitly decided later.

---

## Project conventions to follow

From inspecting the codebase:

- **Framework:** Next.js 16 App Router, React 19, TypeScript
- **Auth:** Supabase Auth via `@supabase/ssr`; `getAuthUser()` in `lib/auth/get-user.ts` returns `User | null`
- **Data access:** Server components and actions use `createAdminClient()` (service role) from `lib/supabase-server.ts` — same pattern here
- **Client Supabase:** `createSupabaseBrowserClient()` from `lib/supabase/browser.ts` for login only — not needed for this module
- **Routing guard:** `middleware.ts` protects `/dashboard` and `/auctions/:path*` — needs updating to add `/live-auction/:path*`
- **Schema management:** No formal migrations folder. SQL is written as scripts in `scripts/sql/` and run manually in the Supabase SQL Editor
- **Types:** Defined in `lib/` — follow same pattern with `lib/live-auction-types.ts`
- **Styling:** Tailwind v4; existing pages use `slate` colour theme with simple tables and cards
- **No RLS dependency:** Admin client bypasses RLS; same approach here

---

## Database design

### New tables

Four new tables. The `live_auction_sales` table is the **sole source of truth**. Squads and budgets are always derived from it — never stored separately.

```sql
-- live_auctions
-- One row per live auction event.
create table live_auctions (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  status        text not null default 'setup',  -- setup | live | paused | completed
  starting_budget integer not null default 350,
  squad_size    integer not null default 18,
  min_bid       integer not null default 5,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

-- live_auction_participants
-- Each person taking part. role = 'admin' grants auctioneer access.
-- user_id is nullable so an admin can add placeholder participants
-- before they sign up (useful pre-auction setup).
create table live_auction_participants (
  id            uuid primary key default gen_random_uuid(),
  auction_id    uuid not null references live_auctions(id) on delete cascade,
  user_id       uuid references auth.users(id),
  display_name  text not null,
  role          text not null default 'participant',  -- participant | admin
  created_at    timestamptz not null default now(),
  unique (auction_id, user_id)
);

-- live_auction_players
-- Player pool for a given auction.
-- fotmob_player_id is the external identifier used for later pipeline import.
create table live_auction_players (
  id               uuid primary key default gen_random_uuid(),
  auction_id       uuid not null references live_auctions(id) on delete cascade,
  fotmob_player_id text not null,
  player_name      text not null,
  team_name        text,
  nation           text,
  position         text,
  status           text not null default 'available',  -- available | sold | unsold
  created_at       timestamptz not null default now(),
  unique (auction_id, fotmob_player_id)
);

-- live_auction_sales
-- Append-only log of completed sales. Source of truth.
-- is_voided = true removes the sale from all calculations.
create table live_auction_sales (
  id               uuid primary key default gen_random_uuid(),
  auction_id       uuid not null references live_auctions(id) on delete cascade,
  player_id        uuid not null references live_auction_players(id),
  participant_id   uuid not null references live_auction_participants(id),
  price            integer not null check (price > 0),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  is_voided        boolean not null default false,
  void_reason      text
);
```

**SQL file location:** `scripts/sql/live-auction-schema.sql`

### Derived calculations (always computed, never stored)

```
budget_remaining(participant)
  = starting_budget
  - SUM(price WHERE auction_id = X AND participant_id = P AND is_voided = false)

squad(participant)
  = JOIN live_auction_sales + live_auction_players
    WHERE participant_id = P AND is_voided = false
```

---

## Routes / pages

New route group: `app/live-auction/`

| Route | File | Who can access |
|-------|------|---------------|
| `/live-auction` | `app/live-auction/page.tsx` | Any logged-in user |
| `/live-auction/[auctionId]` | `app/live-auction/[auctionId]/page.tsx` | Any participant |
| `/live-auction/[auctionId]/team/[participantId]` | `app/live-auction/[auctionId]/team/[participantId]/page.tsx` | Any participant |
| `/live-auction/[auctionId]/admin` | `app/live-auction/[auctionId]/admin/page.tsx` | Admin role only |

### `/live-auction`
- Lists all `live_auctions` rows (for MVP: show all, not filtered by participant)
- Shows name, status, starting budget, squad size
- Links through to the auction overview
- Shows "No auctions yet" if empty

### `/live-auction/[auctionId]`
- Auction name + status badge
- Participants table: name | players bought | total spent | budget remaining
- Recent sales log (last ~20 non-voided sales, newest first): player name, participant, price, time
- Link to each participant's squad page
- If logged-in user has `role = 'admin'` for this auction → show link to `/admin`

### `/live-auction/[auctionId]/team/[participantId]`
- Participant name, starting budget, total spent, remaining budget
- Squad grouped by position (GK → DEF → MID → FWD, then any unrecognised position)
- Each player row: player name | position | club/nation | FotMob ID | price paid
- Mobile-friendly card layout

### `/live-auction/[auctionId]/admin` ← most important
- **Search/select player:** text search over `live_auction_players` (name, team), filtered to `status = 'available'`
- **Select participant:** dropdown of all participants
- **Enter sale price:** number input
- **Validate before saving:**
  1. Player exists and is `available`
  2. Participant exists in this auction
  3. Price > 0
  4. Player not already in a non-voided sale
  5. Participant has enough budget remaining
  6. **Soft warning** (not a hard block) if purchase would leave participant unable to fill remaining squad slots at min_bid (see validation section)
- **Confirm sale** button — runs validation, then inserts into `live_auction_sales` and sets player `status = 'sold'`
- **Recent sales log** (same as overview but with admin actions per row):
  - Undo/void sale
  - Edit sale (price or participant)
- **Mark player unsold/skip** — sets `status = 'unsold'` without creating a sale

---

## Validation logic

Implemented in a server action `app/live-auction/[auctionId]/admin/actions.ts`.

### Hard blocks (reject the sale)

```typescript
// 1. Player must exist and be available
if (!player || player.status !== 'available') → error

// 2. Participant must be in this auction
if (!participant) → error

// 3. Price must be a positive integer
if (price <= 0) → error

// 4. Player must not already have a non-voided sale
const existingSale = sales.find(s => s.player_id === playerId && !s.is_voided)
if (existingSale) → error

// 5. Participant must have enough budget
const budgetRemaining = startingBudget - sumOfNonVoidedSalesForParticipant
if (price > budgetRemaining) → error
```

### Soft warning (show warning but allow proceeding)

```typescript
// Minimum reserve check
// After this purchase:
//   playersOwned = currentSquadSize + 1
//   slotsLeft = squadSize - playersOwned
//   budgetAfterPurchase = budgetRemaining - price
//   minimumNeeded = slotsLeft * minBid
// Warn if budgetAfterPurchase < minimumNeeded
// (not a hard block — participant may intentionally buy fewer than squad_size players)

const playersAfter = currentSquadSize + 1
const slotsLeft = squadSize - playersAfter
const budgetAfter = budgetRemaining - price
const minimumNeeded = slotsLeft * minBid
if (budgetAfter < minimumNeeded && slotsLeft > 0) → soft warning
```

### Undo / void

- Sets `is_voided = true` and `void_reason` (optional free text)
- Sets player `status` back to `'available'`
- Recomputes all derived data on next load — no other changes needed

### Edit sale

- Admin can change `price` or `participant_id` on an existing non-voided sale
- Re-run all validation against the edited values (treating the original sale as if it doesn't exist for "player already sold" check)
- If participant changes, re-run budget check for the new participant
- Update the row in place (not void + re-insert, to keep the audit trail simpler at MVP)

---

## New files to create

### SQL
| File | Purpose |
|------|---------|
| `scripts/sql/live-auction-schema.sql` | All four table definitions |

### Types
| File | Purpose |
|------|---------|
| `lib/live-auction-types.ts` | `LiveAuction`, `LiveAuctionParticipant`, `LiveAuctionPlayer`, `LiveAuctionSale`, `ParticipantSummary`, `SaleWithDetails`, `ValidationResult` |

### Data layer
| File | Purpose |
|------|---------|
| `lib/live-auction-data.ts` | Server-only data loaders using `createAdminClient()` |

### App routes
| File | Purpose |
|------|---------|
| `app/live-auction/page.tsx` | Auction list |
| `app/live-auction/layout.tsx` | Auth guard (redirect to `/login` if not logged in) |
| `app/live-auction/[auctionId]/page.tsx` | Auction overview |
| `app/live-auction/[auctionId]/layout.tsx` | Load auction + check it exists (404 if not) |
| `app/live-auction/[auctionId]/team/[participantId]/page.tsx` | Participant squad |
| `app/live-auction/[auctionId]/admin/page.tsx` | Admin control page |
| `app/live-auction/[auctionId]/admin/actions.ts` | `recordSaleAction`, `voidSaleAction`, `editSaleAction`, `markUnsoldAction` |

### Middleware update
- Add `/live-auction/:path*` to the matcher in `middleware.ts`

---

## Auth and role model

| Check | How |
|-------|-----|
| User is logged in | `getAuthUser()` — redirect to `/login` if null |
| User is a participant | Look up `live_auction_participants` where `user_id = authUser.id AND auction_id = X` |
| User is admin | Same row check with `role = 'admin'` |
| `/admin` page | Server component loads participant row; returns 403/redirect if not admin |

For MVP, the auction list page shows all auctions to any logged-in user (no invite gate). This is intentional and matches the brief.

---

## Player pool — how players get into `live_auction_players`

The existing `players` table already contains FotMob player data (id, name, position, team). Confirmed: `players.player_id` **is** the FotMob ID (matches `fotmob.com/en-GB/players/{player_id}/`).

### Seeding approach

Before a live auction, the admin (or commissioner) picks which players to make available — typically players from the big nations/clubs (Brazil, England, Argentina, Germany, etc.). The rest are left for the online bidding phase.

**Recommended: a seed script** `scripts/seed-live-auction-players.mjs`

The script would:
1. Accept an `auction_id` and a list of `team_id`s or `team_name`s (the nations/clubs to include)
2. Query the existing `players` table for those teams
3. Insert rows into `live_auction_players` (copying `player_id` as `fotmob_player_id`, plus name/position/team)
4. Skip any players already added (upsert on `(auction_id, fotmob_player_id)`)

This gives flexibility — you can run it multiple times to add more teams, or manually insert individual players via the Supabase dashboard if needed.

### Why not FK to `players`?

`live_auction_players` stores a **copy** of the player data rather than a foreign key to `players`. This keeps the live auction module fully isolated. The `fotmob_player_id` (integer, matches `players.player_id`) is the bridge for future pipeline import — a simple JOIN on that field brings the squads back together.

### Future pipeline import

When the live auction ends and you want to transfer squads into the main game:
```sql
-- Example: find live auction winners and match to main pipeline players
SELECT
  lap.fotmob_player_id,
  p.player_name,
  las.participant_id,
  las.price
FROM live_auction_sales las
JOIN live_auction_players lap ON lap.id = las.player_id
JOIN players p ON p.player_id = lap.fotmob_player_id
WHERE las.auction_id = '<id>'
  AND las.is_voided = false;
```

---

## What is NOT built in this MVP

- Online bidding (bids happen verbally)
- Real-time Supabase subscriptions (manual refresh is fine)
- Integration with `/auctions` pipeline
- Scoring or points
- Player seed script UI (script is CLI/manual for now)
- Fancy animations, timers, or drama features
- Mobile push notifications

---

## MVP success condition

> During a live Zoom auction, an admin can record each completed sale in under 5 seconds, and every participant can refresh their page to see accurate squads, budgets, and recent sales.

---

## Implementation order (when ready to build)

1. Create and run `scripts/sql/live-auction-schema.sql` in Supabase SQL Editor
2. Add `lib/live-auction-types.ts`
3. Add `lib/live-auction-data.ts` (data loaders)
4. Update `middleware.ts` matcher
5. Build `app/live-auction/` layout + list page
6. Build `app/live-auction/[auctionId]/` layout + overview page
7. Build `app/live-auction/[auctionId]/team/[participantId]/page.tsx`
8. Build `app/live-auction/[auctionId]/admin/` page + actions (most important)
9. Write `scripts/seed-live-auction-players.mjs` (copy players from `players` table by team)
10. Smoke test: create a live auction row manually in Supabase, seed some players, add participants, run through a full sale/void/edit cycle
