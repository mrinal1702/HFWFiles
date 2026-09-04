# Ops: Player releases (paid & free)

**Canonical for agents.** Older detail also in [PLAYER_RELEASE_SYSTEM.md](./PLAYER_RELEASE_SYSTEM.md) — if they conflict, prefer this file + current SQL.

Related: [OPS_BIDDING_AND_DEADLINES.md](./OPS_BIDDING_AND_DEADLINES.md), [OPS_ELIMINATIONS.md](./OPS_ELIMINATIONS.md).

---

## What it is

A manager **voluntarily** returns an owned player to the pool from **My Team** (`/auctions/[id]/team`).

Live auction has **no** releases.

---

## Types

| Type | Limit | Refund | Notes |
|------|-------|--------|-------|
| **Paid** | **1 per manager per bidding window** (`paid_release_used`) | Half price: `floor((purchase_price + 1) / 2)` | Same formula as elimination refunds |
| **Free** | Unlimited | **0** | Always available (unless other blocks) |

Refund credits **both** `budget_remaining` and `active_budget` immediately.

---

## What happens to the player

1. Row removed from `auction_teams`
2. Lot reset to `uninitiated` (clears high bidder / expiry)
3. Audit row in `auction_releases` (`paid` | `free`)
4. Player appears again in the bidding room for anyone (including the same manager)

Historical `auction_bids` rows are kept (append-only).

---

## Blocks (standard)

| Condition | Typical error / behaviour |
|-----------|---------------------------|
| Paid release while bidding closed | `paid_release_bidding_closed` (see `auction-releases-paid-when-bidding-open.sql`) |
| Manager relegated | `participant_relegated` / app guard |
| Nation-rolling: nation’s `hard_deadline_at` passed | `player_nation_locked` — cannot release that nation’s players |

---

## Commissioner: reset paid quota

Between gameweek windows (or when opening a new rolling round):

```sql
UPDATE public.auction_users
SET paid_release_used = false
WHERE auction_id IN (...);
```

`scripts/open-nation-rolling-round.mjs` does this for configured auctions.

There is **no** participant UI for this reset.

---

## SQL / code map

| Asset | Role |
|-------|------|
| `scripts/sql/auction-releases.sql` | Base `release_player` RPC + `auction_releases` table |
| `scripts/sql/auction-releases-paid-when-bidding-open.sql` | Paid only while bidding open |
| `scripts/sql/nation-rolling-bidding-rpc.sql` / `participant-relegation-rpc.sql` | Nation lock + relegated blocks (when deployed) |
| `app/auctions/[auctionId]/team/_components/ReleaseButton.tsx` | UI |

---

## Standardization rules

- Do not invent a second refund formula in app code — match the RPC.
- Do not treat elimination refunds as “using” the paid release (`paid_release_used` stays unchanged on eliminations).
- Do not add release to live-auction admin.
