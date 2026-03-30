# Auction app — user interface & deployment

This document describes the **current user-facing UI** for the fantasy auction (`auction-app`), how it maps to data, and **how to deploy** it in this monorepo. Use it alongside the technical handoff in **`BIDDING_SYSTEM_AND_UI_HANDOFF.md`** (schema, RPCs, SQL).

---

## 1. Deployment (Vercel + Git)

The Next.js app is **not** at the repository root. Vercel must use:

| Setting | Value |
|--------|--------|
| **Root Directory** | `auction-app` |
| **Framework** | Next.js |
| **Output Directory** | *(empty / default)* |
| **Production build** | `npm run build` → `next build --webpack` (see `package.json`) |

**Authoritative playbooks** (repo root `docs/`):

- **`docs/VERCEL_DEPLOYMENT_PLAYBOOK.md`** — full Vercel checklist, webpack choice, `/api/health` + `/vercel-check.txt`, env vars, what not to do (SPA rewrites).
- **`docs/GIT_AND_VERCEL.md`** — Git remote, push workflow, env var names.
- **`docs/VERCEL_404_TROUBLESHOOTING.md`** — if the live site returns 404 on every route.

**Environment variables** (set in Vercel for Production/Preview; mirror in local `auction-app/.env.local`, never commit secrets):

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — server actions for bids, joins, dashboard loaders |

Optional: `ADMIN_EMAIL` (reserved for future commissioner tools).

After changing env vars, **redeploy**. After local commits, **`git push`** so Vercel builds the intended commit (stale `main` → old routes or missing `/api/health`).

---

## 2. Major UI surfaces (routes)

| Area | Route / notes |
|------|----------------|
| Home / marketing | `/` |
| Auth | `/login`, `/signup` |
| Auction list / join | `/dashboard`, join by code where configured |
| **Bidding room** (main table) | `/auctions/[auctionId]/bidding-room` |
| My team | `/auctions/[auctionId]/team` |
| Bids held | `/auctions/[auctionId]/bids-held` |
| Leaderboard, points | `/auctions/[auctionId]/leaderboard`, `/points` |
| Competitors | `/auctions/[auctionId]/competitors`, `/competitors/[auctionUserId]` |
| **Player detail + bid** | `/auctions/[auctionId]/players/[playerId]` — bid form, optional `?returnTo=` for back navigation |
| **Auction Lab** (integration / dev) | `/auction-lab` — **not** linked from normal navigation; uses service-role flows; protect or omit in production |

Navigation highlights the bidding experience (including when viewing a player under the same auction).

---

## 3. Bidding room behavior

- **Tabs:** All players, Ongoing bids, Unsold (no bids / closed unsold), Sold, Search player.
- **Theme:** Light **white + sky** palette, mobile-first layout (e.g. sticky budget context on small screens).
- **Filters:** Club, position, status (on “All”), bidder (on “Ongoing”), plus **Sort** (see below).
- **Player names** link to the **player detail** URL; **Back** respects `returnTo` when present so users return to bidding room, competitor view, etc., not always the room.
- **Bid errors:** User-facing copy is centralized (`lib/bid-ui-messages.ts`, `lib/auction-bid-gates.ts`, server actions) so messages match product rules (minimum bid, increments, budget, roster caps, etc.).

---

## 4. Default list sort (“Sort” → first option)

When **Sort** is the default (label in UI: **Default (ongoing → unsold → sold)**), rows are ordered as follows:

1. **Active ongoing bids** — lots with `status === "bidding"` while the auction is still open for bidding (`hard_deadline_at` / pause not closing the UI). Among these, **`expires_at` descending** (latest deadline first), so the most recently “hot” lots surface first. Tie-break: `player_id`.
2. **Unsold / not sold** — e.g. `uninitiated`, `unsold`, and `bidding` after the auction has closed in the UI (until finalize catches up). Secondary order: **`players.team_id` ascending**, then **position** (goalkeeper → defender → midfielder → forward → other), then **`player_id`**. Rows without `team_id` sort after numeric ids.
3. **Sold** — same secondary order as (2): **team_id → position → player_id**.

**Implementation notes:**

- **`team_id`** and **`team_name`** (shown as “club”) come from Supabase **`players`**; `EnrichedLot` includes `team_id` for sorting.
- **Position order** uses `positionSortRank()` in `lib/bid-ui-messages.ts` (normalized substring checks on `position` text).

Other sort options (deadline ↑/↓, bid high/low) override this for manual analysis.

---

## 5. Data the UI relies on (summary)

The dashboard loader (`lib/auction-dashboard.ts`) builds **`EnrichedLot`** rows per auction:

- Identity: `player_id`, `player_name`
- Club / sort: `club` (from `team_name`), **`team_id`**
- `position`, `status`, `expires_at`
- High bid: `high_bidder_id`, `high_bidder_name`, `high_amount` (from current bid or, when sold, from `auction_teams`)

Hard deadline finalization: on load, **`finalize_auction_hard_deadline`** may run when past `hard_deadline_at` (see handoff doc §9).

---

## 6. Evolution checklist (what we standardized)

Useful for future contributors:

- Monorepo: **Vercel Root Directory = `auction-app`**, webpack production build, health endpoints for smoke tests.
- **User-facing** bidding UI: bidding room, team, bids held, player search/detail, competitor views, friendly bid error strings.
- **Navigation UX:** player links, `returnTo` back behavior, bidding room default sort tiers + team/position ordering.
- **Docs:** this file + `BIDDING_SYSTEM_AND_UI_HANDOFF.md` + `TESTING_OPERATIONS.md` + root `docs/VERCEL_*`.

---

*Update this file when shipping major UX or deploy workflow changes.*
