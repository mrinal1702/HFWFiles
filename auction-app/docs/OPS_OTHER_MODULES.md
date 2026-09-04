# Ops: Other online-auction modules

**Canonical pointers** so agents do not miss systems that ran in the World Cup season and should remain available.

Related: [OPS_INDEX.md](./OPS_INDEX.md).

---

## 1) Transfer room

Peer-to-peer player swaps with cash.

- Detail doc: [TRANSFER_ROOM.md](./TRANSFER_ROOM.md)
- SQL: `scripts/sql/auction-transfers.sql`
- Gate: `"Auctions".transfer_window_open`
- Hard deadline can void open transfers (`void_expired_transfers`)
- Relegated managers blocked from new activity

**Standard:** toggle the window via SQL/admin; do not build a second transfer UI.

---

## 2) Announcements feed

- Doc: [ANNOUNCEMENTS.md](./ANNOUNCEMENTS.md)
- Route: `/auctions/[id]/announcements`
- Composes sales, voluntary releases, elimination refunds, etc.

**Standard:** new event types should plug into the same feed pattern, not a separate inbox.

---

## 3) Acting-as / multi-seat

Managers may have multiple `auction_users` rows (rare) or commissioners need to inspect seats.

- UI: `ActingAsPicker.tsx`
- Cookie: `lib/auction-actor-cookie.ts`
- Resolution in `loadAuctionDashboard`

**Standard:** keep view-only mode for safe browsing.

---

## 4) Archives & auction history

| Feature | Config / code |
|---------|----------------|
| Which auctions are archived | `lib/archived-auctions.ts` → `ARCHIVED_AUCTION_IDS` |
| History years | `AUCTION_HISTORY_YEARS` in same file |
| History ranks | `lib/auction-history.ts` ← live `auction_leaderboard` |

After a competition ends: add IDs to the archived set (and years). Do not leave finished leagues on Active Auctions.

Optional SQL: set `is_active = false` on those auctions (bidding closed) — UI archive filter is ID-based.

---

## 5) Join codes & auth

- Join: dashboard form → `app/dashboard/actions.ts` inserts `auction_users` with `user_id`
- Codes: typically 6–8 characters on `"Auctions".join_code`
- Auth pages: `/login`, `/signup`, password recovery docs

**Standard:** every participant is a real Supabase user linked to a seat.

---

## 6) Live auction (separate product)

Verbal / Zoom auctions recorded in-app.

- Routes: `/live-auction/*`
- Docs: [LIVE_AUCTION_COMMISSIONER_GUIDE.md](./LIVE_AUCTION_COMMISSIONER_GUIDE.md), [LIVE_AUCTION_MODULE_PLAN.md](./LIVE_AUCTION_MODULE_PLAN.md)
- SQL: `live-auction-schema.sql`, `live-auction-rpc.sql`

**Do not** mix live-auction tables with online `place_bid` / releases / Best XI.

---

## 7) Meme Builds (parked)

Experimental side game under `/meme-builds`. **Not** part of standard auction ops. Left in codebase but removed from the participant dashboard. Do not revive mid-competition without a product decision.

---

## 8) Commissioner script toolkit (online)

| Script | Use |
|--------|-----|
| `open-nation-rolling-round.mjs` | Open knockout bidding window |
| `lock-gameweek-squads.mjs` | Snapshot squads |
| `upsert-player-scores-from-finalpoints.mjs` | Load points |
| `publish-best-xi-from-json.mjs` | Publish XI + leaderboard |
| `apply-elimination-refunds.mjs` | Nation knockouts |
| `apply-participant-relegations.mjs` | Cut managers |
| `delete-trial-auction-8.mjs` | Example of full auction wipe (lab only) |

Prefer these over ad-hoc SQL dumps when an equivalent exists.

---

## 9) Testing / lab

- [TESTING_OPERATIONS.md](./TESTING_OPERATIONS.md)
- Helpers: `scripts/sql/testing-auction-helpers.sql`, `reset-testing-environment.sql`
- Never point lab wipes at production auction IDs without explicit confirmation.

---

## 10) Player pool prep

Before an auction exists:

- `docs/AUCTION_PREPARATION_PROCEDURE.md` (repo root)
- Import tools under `auction-app/scripts/` (`import-master-player-list.mjs`, `seed-auction-lots.mjs`, etc.)

Pool quality (IDs, `team_name` spelling) affects eliminations and nation-rolling — treat as part of ops readiness.
