# Bidding system & UI handoff

This document is the **single handoff** for anyone (or any Cursor agent) building the **user-facing bidding UI** on top of the existing **Supabase + Next.js** stack. It matches the code and SQL in **`auction-app`** as of its last update.

---

## 1) Architecture (what exists today)

| Layer | Role |
|--------|------|
| **PostgreSQL (Supabase)** | Source of truth: lots, bids, budgets, rosters, deadlines. **Business rules** live in RPC functions (`place_bid`, `finalize_auction_hard_deadline`, etc.). |
| **Next.js server** | `lib/supabase-server.ts` — **service role** client only on the server. Never expose the service key to the browser. |
| **`/auction-lab`** | Minimal **integration test** page: lists `auction_users` + `auction_lots`, submits bids via Server Action. **Not** a polished product UI. |
| **`lib/bidding.ts`** | Typed wrappers for `place_bid` and `finalize_auction_hard_deadline`. |

**Multi-auction rule:** Almost every query and mutation is scoped by **`auction_id`**. The UI must always know **which auction** the user is in (selector, route segment, or session).

**Game weeks:** Stored in **`Game_Weeks`** (PascalCase table; columns like `GW_Name`, `Is_Active`). Bidding logic does **not** require a game week id inside `place_bid`; scores and leaderboards do. Multiple auctions can **share** the same active game week for real deployment.

---

## 2) Core tables (bidding-relevant)

Names below are **as used in app code**; Supabase may expose PascalCase mirrors—confirm in Dashboard.

### `Auctions` (quoted `"Auctions"` in SQL)

- `id` (bigint) — **auction_id** everywhere else  
- `name` (text)  
- `is_active` (boolean)  
- `hard_deadline_at` (timestamptz) — **global** stop bidding; required for `place_bid`  

### `auction_users`

- `id` — **auction_user_id** (bidder identity in this auction)  
- `auction_id` — FK to auction  
- `name` — display label (no auth yet)  
- `budget_remaining` — spent only on **completed** purchases (`auction_teams`)  
- `active_budget` — `budget_remaining` minus **unresolved** winning commitments (current high bids)  

### `auction_lots` (PK `(auction_id, player_id)`)

- `status`: `uninitiated` \| `bidding` \| `sold` \| `unsold`  
- `expires_at` — rolling window end (capped by `hard_deadline_at`)  
- `current_high_bid_id` → `auction_bids.id`  
- `current_high_bidder_id` → `auction_users.id`  

### `auction_bids` (append-only)

- `auction_id`, `player_id`, `auction_user_id`, `amount` (integer), `created_at`  

### `auction_teams`

Roster of **sold** players: `auction_id`, `auction_user_id`, `player_id`, `purchase_price`.

### `players`

Global pool: at least `player_id`, `player_name`, `position` (GK vs outfield for caps). **`auction_lots`** reference `player_id` as text.

---

## 3) RPCs (call from server with service role or via `supabase.rpc` as appropriate)

### `place_bid(p_auction_id, p_player_id, p_auction_user_id, p_amount)` → JSON

- Validates: deadline, lot state, min bid 5, integer amounts, increment rules (below 50: any higher integer; from 50+: +5 min step), **active_budget**, **18 players** and **1 GK / 17 outfield** caps counting **sold + current highs**, self-raise allowed, no retractions.  
- Locks lot + users; updates `auction_lots`, inserts `auction_bids`, adjusts `active_budget` (release previous leader, reserve new).  
- May auto-finalize a **single** lot if its `expires_at` passed (see SQL comments).  

**TypeScript:** `placeBid(client, { auctionId, playerId, auctionUserId, amount })` in `lib/bidding.ts`.

### `finalize_auction_hard_deadline(p_auction_id, p_force default false)` → JSON

- After deadline (or `p_force` for admin tests): sell all lots with a high bid into `auction_teams`, mark no-bid lots `unsold`, set **`active_budget = budget_remaining`** for all users in that auction.  

**TypeScript:** `finalizeAuctionHardDeadline(client, { auctionId, force? })`.

### `reset_testing_environment()` → JSON

Full test reset (see `docs/TESTING_OPERATIONS.md`). Not for end users.

### `seed_auction_lots_for_auction(p_auction_id)` → JSON

Inserts **`uninitiated`** lot per row in `players` for that auction. Idempotent.

### `create_stacked_test_auction(...)` → JSON

New auction + new managers + seed lots (multi-auction testing).

### `replace_auction_users_fresh_state(p_auction_id, p_user_count, p_start_budget)` → JSON

Wipes **one** auction’s bidding data + replaces its `auction_users`, re-seeds lots.

---

## 4) Product rules (summary for UI copy / validation hints)

- Opening bid **≥ 5**, integers only.  
- **Budget 350** default for test resets; **no decimals**.  
- **Self-raise** allowed.  
- **Rolling 24h** from last valid bid on a lot, **capped** by `hard_deadline_at`.  
- **Roster:** max **18** total slots; max **1 GK**; max **17** outfield — counts **sold + any lot where user is current high bidder**.  
- **Sold** players stay out of the pool for this design (`sold` / `unsold` terminal states).  

Surface **`budget_remaining`**, **`active_budget`**, **current high bid**, **lot status**, **`expires_at`**, and **hard deadline** in the UI so users understand why a bid was rejected.

---

## 5) Environment variables (`auction-app`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe key (home page smoke test only) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — auction lab, scripts, future protected API routes |
| `AUCTION_LAB_AUCTION_ID` | Which auction **`/auction-lab`** targets (updated by `npm run reset:testing`) |

---

## 6) Existing UI entry points (for reference)

- **`app/auction-lab/page.tsx`** — Server Component: reads auction, users, lots (+ joins `players`, `auction_bids` for display).  
- **`app/auction-lab/BidForm.tsx`** — Client form + `useActionState` → **`app/auction-lab/actions.ts`** → `placeBid` + `revalidatePath`.  

When building the real UI, **reuse** `lib/bidding.ts` and the same RPC contracts; replace layout/navigation/auth as needed.

---

## 7) Security & production warnings

- **`/auction-lab`** + service role on the server = **any visitor could bid as any manager** if deployed publicly. **Protect** with auth, VPN, IP allowlist, or remove before production.  
- Prefer **authenticated users** + **RLS** (or server routes that map `auth.uid()` → `auction_user_id`) before going live.  
- **`AGENTS.md`** in `auction-app` notes Next.js 16 API differences—check `node_modules/next/dist/docs/` when upgrading patterns.  

---

## 8) SQL file map (`auction-app/scripts/sql/`)

| File | Contents |
|------|-----------|
| `auction-bidding.sql` | `auction_lots`, `auction_bids`, `Auctions.hard_deadline_at`, `place_bid`, `finalize_auction_hard_deadline`, helpers |
| `reset-testing-environment.sql` | `reset_testing_environment` |
| `seed-auction-lots-all-players.sql` | `seed_auction_lots_for_auction` + optional DO block |
| `testing-auction-helpers.sql` | `create_stacked_test_auction`, `replace_auction_users_fresh_state` |
| `standalone-finalize-auction-hard-deadline.sql` | **Single paste** for Supabase: only `finalize_auction_hard_deadline` (avoids partial runs of the big script) |

---

## 9) Hard deadline & Supabase (product behavior + pitfalls)

- **Settlement is not a cron at T+0.** On the **first server load** of an auction after `hard_deadline_at`, `loadAuctionDashboard` (`lib/auction-dashboard.ts`) calls `finalize_auction_hard_deadline` if any lot is still `bidding` or `uninitiated`, then refetches lots/users. Any page using that loader (layout, bidding room, My team, Bids held, etc.) triggers it. Idempotent after lots are terminal.
- **UI:** `biddingClosed` follows browser time vs `hard_deadline_at`; the RPC uses Postgres `clock_timestamp()`. They should match within normal skew.
- **Sold display:** After finalize, `current_high_bid_id` is cleared on sold lots; the dashboard joins **`auction_teams`** to show winner and price on sold rows.
- **Resolved production issue:** If `auction_teams.player_id` is **int4** while `auction_lots.player_id` is **text**, the finalize function must use **`t.player_id::text = v_lot.player_id::text`** in the existence check and **`v_lot.player_id::integer`** in the `INSERT`. Use **`standalone-finalize-auction-hard-deadline.sql`** in Supabase so the deployed function matches the repo (partial pastes of `auction-bidding.sql` left an old body in place).
- If the RPC is **missing**, the app logs and **still loads** (no 500) but rosters stay wrong until SQL is applied.

---

## 10) Checklist for the new bidding UI agent

1. Read **`TESTING_OPERATIONS.md`** so you know how to populate data.  
2. Always scope reads/writes by **`auction_id`**.  
3. Call **`place_bid`** / **`finalize_...`** only from **trusted server code** with the service role (or equivalent secure path).  
4. Mirror displayed fields with DB columns above; handle RPC **error strings** (`bid_too_low`, `insufficient_active_budget`, `roster_full`, etc.).  
5. Plan auth + RLS before public deployment.  

When in doubt, compare behavior to **`/auction-lab`** and the JSON returned by RPCs.

**New chats:** Point the agent at this file + **`lib/auction-dashboard.ts`** + **`scripts/sql/auction-bidding.sql`** so bidding context does not depend on prior threads.
