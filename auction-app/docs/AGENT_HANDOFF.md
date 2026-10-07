# HFW Auction App — Agent Handoff (product orientation)

Last updated: October 2026

> **IMPORTANT — HFW = "How Football Works"** (not "Half Full Whistle" or any other expansion). Do not get this wrong.

This is the **product orientation** doc for an agent or new contributor. Read it for context and the "do not break" rules, then use the two authoritative references below for details.

| For… | Read |
|------|------|
| **Day-to-day ops** (bidding, locks, scoring, relegations, eliminations, UI standards) | **[`OPS_INDEX.md`](./OPS_INDEX.md)** and the `OPS_*.md` docs it links |
| **The live database schema** (every table, view, RPC → its canonical SQL file) | **[`../scripts/sql/README.md`](../scripts/sql/README.md)** |
| **Frozen participant UI** | **[`ui-contracts/AUCTION_PAGES.md`](./ui-contracts/AUCTION_PAGES.md)** (current state) · **[`ui-contracts/LEADERBOARD.md`](./ui-contracts/LEADERBOARD.md)** (scoring) |

Do **not** improvise one-off SQL or procedures when an OPS doc and a script already exist.

---

## What this project is

**HFW Auction** is a fantasy football auction app for a private group of friends. Real-world footballers are auctioned off; each participant builds a squad, and those players earn points based on real match performances (Premier League, Champions League, World Cup, etc.).

Two distinct products, one codebase:

### 1. Online auction (`/auctions/*`) — live in production, do not break
Asynchronous online bidding over a rolling time window. Managers bid, release, and transfer players; squads are locked per gameweek and scored. This is the main product.

### 2. Live auction (`/live-auction/*`) — fully built, **isolated module**
A recording interface for verbal auctions on Zoom/in person. Bidding happens offline; an admin records completed sales; participants view squads/budgets. **Fully isolated from the online pipeline** — no scoring or transfer integration. Details:
- **[`LIVE_AUCTION_COMMISSIONER_GUIDE.md`](./LIVE_AUCTION_COMMISSIONER_GUIDE.md)** — setup, seeding, admin workflow, troubleshooting.
- **[`LIVE_AUCTION_MODULE_PLAN.md`](./LIVE_AUCTION_MODULE_PLAN.md)** — design and conventions.

Its tables (`live_auctions`, `live_auction_participants`, `live_auction_players`, `live_auction_sales`, `live_auction_admin_grants`) and RPCs (`record_live_sale`, `void_live_sale`) are listed in [`../scripts/sql/README.md`](../scripts/sql/README.md). Squads/budgets are always **computed from `live_auction_sales`**, never stored separately.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth via `@supabase/ssr` |
| Hosting | Vercel — **Root Directory must be `auction-app/`** |
| Styling | Tailwind CSS v4 |
| Schema management | **Manual SQL** run in the Supabase SQL Editor (no migration runner) — every object is indexed in [`../scripts/sql/README.md`](../scripts/sql/README.md) |

- **Live URL:** https://hfwauction.vercel.app
- **Supabase project:** `ealowpaiiwsrbwucgkng.supabase.co`
- **Deploy notes:** repo-root `docs/VERCEL_DEPLOYMENT_PLAYBOOK.md`, `docs/GIT_AND_VERCEL.md`. Commit to `main` → Vercel auto-deploys.

---

## Current state (October 2026)

The database is competition-scoped (see repo-root `docs/context/COMPETITION_AUCTION_DATA_ISOLATION.md`). Active vs archived competitions are defined by `competitions.status` in Supabase (mirrored in each `competitions/**/competition.json`). **An auction is archived when its competition is archived** — it moves from Active Auctions to Archives, and stays readable (leaderboard, squads, match scores, Auction History). See `OPS_OTHER_MODULES.md` §4.

| Competition | `competition_id` | Auctions | Status |
|-------------|------------------|----------|--------|
| UEFA Champions League 2026/27 | 4 | 10, 11, 12, 13 | **active** |
| English Premier League 2026/27 | 2 | 9 | archived Oct 2026 (season complete, MW1–MW4 published) |
| FIFA World Cup 2026 | 1 | 5, 6, 7 | archived |
| UEFA Champions League 2025/26 | 3 | — | archived |

- The `players` master pool holds real players (hundreds, refreshed per competition) — **not** the small club test set described in older drafts of this doc.
- The live database has roughly **30 tables/views and 27 RPCs**. Do not rely on this doc for the list — **[`../scripts/sql/README.md`](../scripts/sql/README.md)** is the verified source of truth for what exists and which SQL file is canonical for each object.

---

## Repository structure

```
HFWFiles/                     ← git repo root
├── auction-app/              ← Next.js app (Vercel Root Directory)
│   ├── app/                  ← App Router pages (auctions/, live-auction/, dashboard/, login/, api/…)
│   ├── lib/                  ← Server utilities (supabase-server.ts, auth/, data loaders)
│   ├── scripts/              ← Node maintenance scripts (.mjs)
│   │   └── sql/              ← Manual SQL + README.md canonical index (+ _superseded/ archive)
│   ├── data/                 ← Committed publish artifacts (best-xi/, match-scores/)
│   └── docs/                 ← Project documentation (this folder)
├── competitions/             ← Competition-scoped scoring data (active/ + archive/)
├── scoring-engine/, formation-engine/, scripts/  ← Python scoring pipeline (run locally; not deployed)
└── docs/                     ← Repo-root deploy/scoring/context docs
```

---

## Data access conventions (follow these or you will break things)

1. **Server Components / Server Actions / Route Handlers** → use `createAdminClient()` from `lib/supabase-server.ts` (service role, bypasses RLS).
2. **Auth checks** → `getAuthUser()` from `lib/auth/get-user.ts` (returns `User | null`).
3. **Client Components** → never import `supabase-server.ts`; the service role key stays server-side.
4. **No RLS reliance** — the app enforces access with server-side auth checks, not database RLS.
5. **Schema changes** → write/extend a file in `scripts/sql/`, run it in the Supabase SQL Editor, and **update `scripts/sql/README.md`** in the same commit. No ORM, no formal migrations.

Environment variables (`auction-app/.env.local`, never committed):

```
NEXT_PUBLIC_SUPABASE_URL=https://ealowpaiiwsrbwucgkng.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<secret key — server only>
```

The `sb_publishable_*` / `sb_secret_*` keys work only via the `@supabase/supabase-js` SDK, not as raw curl headers.

---

## GitHub Actions

`.github/workflows/keepalive-supabase.yml` pings Supabase every 12h (free tier auto-pauses). Uses Node 22 + the Supabase SDK (required for the key format). Can be triggered manually.

---

## Key conventions

- `export const dynamic = "force-dynamic"` on every page that reads from the database.
- `params` in Next.js 16 is a `Promise<{ … }>` — always `await params`.
- Online-auction IDs are integers (`"Auctions".id`); live-auction IDs are UUIDs.
- `players.player_id` = **FotMob player ID** — the external identifier linking players across systems.
- Tailwind palette: `slate` (text/borders), `sky` (links/highlights), `red` (errors), `amber` (warnings), `green` (success). Card style: `rounded-xl border border-sky-100 bg-white p-5 shadow-sm`.
- **Do not change participant-facing UI** unless explicitly asked (see `ui-contracts/LEADERBOARD.md` and `OPS_UI_SURFACES.md`).
- Commit to `main` — Vercel deploys automatically.

---

## Feature documentation

| Doc | Covers |
|-----|--------|
| `OPS_INDEX.md` | Ops handbook entry point (bidding, locks, scoring, relegations, eliminations, UI) |
| `../scripts/sql/README.md` | Canonical schema index (tables, views, RPCs → SQL file) |
| `ui-contracts/AUCTION_PAGES.md` | **UI contract:** current-state pages (bidding room, My team, Bids held, Competitors – Bidding) |
| `ui-contracts/LEADERBOARD.md` | **UI contract:** everything scoring (Standings, My Points, Competitors – Points) |
| `OPS_RELEASES.md` | Release types, windows, refunds |
| `TRANSFER_ROOM.md` | Peer-to-peer transfers |
| `LIVE_AUCTION_COMMISSIONER_GUIDE.md` | Live auction setup + admin workflow |
| `OPS_UI_SURFACES.md` | Participant UI map + mobile chrome |
| `TESTING_OPERATIONS.md` | Reset/seed helpers, multi-auction test setup |
