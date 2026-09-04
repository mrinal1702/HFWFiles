# Player Release System — Online Auction

> **Ops canonical:** [`OPS_RELEASES.md`](./OPS_RELEASES.md) (July 2026). Prefer that doc for agent training and commissioner steps.

Last updated: June 2026

---

## What it is

After winning a player at auction, a manager can **release** that player back into the available pool. This removes the player from their squad and makes them biddable again by anyone (including the same manager).

Releases are only available in the **online auction** (`/auctions/*`). The live auction has no release mechanic.

---

## Release types

### Paid release
- **1 per manager per Game Week window.**
- Returns **ceil(purchase_price / 2)** to the manager's budget — always a whole number, rounded up for odd prices.
  - Example: bought for £40 → get £20 back
  - Example: bought for £41 → get £21 back
- The refund is added to both `budget_remaining` and `active_budget` immediately, so it can be spent on the next bid straight away.
- Once used, the paid release is gone for that GW window. The manager can still release other players for free.

### Free release
- **Unlimited — always available.**
- No refund. The player is released at zero cost.
- Useful for dropping a player you no longer want without spending your paid release.

---

## What happens to the released player

The player's auction lot is **fully reset to a fresh uninitiated state**:

- Removed from the manager's squad (`auction_teams` row deleted)
- Lot status set back to `uninitiated`
- All bid state cleared: no high bidder, no expiry timer
- Historical bids in `auction_bids` are preserved (append-only table) but have no effect on the fresh lot
- The player appears in the bidding room as a normal unsold player, available for anyone to open a bid on from the minimum (£5)

---

## Game Week windows and resetting the counter

A **Game Week window** is defined by the auction's `hard_deadline_at`. Managers have 1 paid release available before the hard deadline is reached.

After GW1 ends and before GW2 bidding opens, the commissioner resets all paid release counters via SQL:

```sql
UPDATE auction_users SET paid_release_used = false WHERE auction_id = <auction_id>;
```

There is no UI for this reset — it is done manually by the commissioner between game weeks. This is intentional: GW transitions involve several manual steps (recording scores, re-opening bidding) and the reset is one of them.

---

## UI flow (manager's perspective)

The **My Team** page (`/auctions/[id]/team`) shows a red **Release** button next to every player in the squad.

**If the paid release has not been used yet:**

> "You only get half price back on 1 release per Game Week. How do you want to release this player?"
>
> **Paid (£N back)** — **Free** — Cancel

**If the paid release has already been used:**

> "You have used your paid release. Do you want to release this player for free?"
>
> **Yes, release for free** — **No, keep player**

After a successful release the squad refreshes automatically.

---

## Database design

### Column added to `auction_users`

| Column | Type | Default | Meaning |
|--------|------|---------|---------|
| `paid_release_used` | boolean | false | Whether this manager has used their paid release in the current GW window |

### New table: `auction_releases` (audit log)

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigserial | PK |
| `auction_id` | bigint | FK → `"Auctions"` |
| `auction_user_id` | bigint | FK → `auction_users` |
| `player_id` | text | FotMob player ID |
| `release_type` | text | `'paid'` or `'free'` |
| `purchase_price` | int | Original winning bid |
| `refund_amount` | int | 0 for free, ceil(price/2) for paid |
| `created_at` | timestamptz | When the release happened |

Every release — paid or free — is written here. This is the audit trail if disputes arise.

### RPC: `release_player`

Defined in `scripts/sql/auction-releases.sql`. Runs as a single atomic transaction.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_auction_id` | bigint | The auction |
| `p_player_id` | text | The player being released |
| `p_auction_user_id` | bigint | The releasing manager's `auction_users.id` |
| `p_release_type` | text | `'paid'` or `'free'` |

**Returns:** `{ "ok": true, "refund_amount": N }` or `{ "ok": false, "error": "<code>" }`

**Error codes:**

| Code | Meaning |
|------|---------|
| `invalid_release_type` | `p_release_type` was not `'paid'` or `'free'` |
| `player_not_owned` | No `auction_teams` row found for this player + manager |
| `paid_release_already_used` | Manager already used their paid release this window |

**What the RPC does (in order, all in one transaction):**
1. Validates `p_release_type`
2. Locks and fetches the `auction_teams` row (confirms ownership, gets `purchase_price`)
3. For paid: locks `auction_users`, checks `paid_release_used = false`, calculates refund as `(purchase_price + 1) / 2`
4. Deletes the `auction_teams` row
5. Resets `auction_lots`: `status = 'uninitiated'`, clears `current_high_bid_id`, `current_high_bidder_id`, `expires_at`
6. For paid: increments both `budget_remaining` and `active_budget` by the refund, sets `paid_release_used = true`
7. Inserts into `auction_releases`

---

## Application code

| File | Role |
|------|------|
| `scripts/sql/auction-releases.sql` | Schema migration + RPC (run once in Supabase SQL Editor) |
| `lib/auction-types.ts` | `paid_release_used` field on `AuctionUserRow` |
| `lib/auction-dashboard.ts` | Selects `paid_release_used` when loading auction users |
| `app/auctions/[auctionId]/team/actions.ts` | `releasePlayerAction` server action (auth + RPC call + revalidation) |
| `app/auctions/[auctionId]/team/_components/ReleaseButton.tsx` | Client component: Release button + conditional modal |
| `app/auctions/[auctionId]/team/page.tsx` | Passes `paid_release_used` and player data to `ReleaseButton` |

---

## Commissioner operations reference

### Reset paid releases between Game Weeks
```sql
UPDATE auction_users SET paid_release_used = false WHERE auction_id = <auction_id>;
```

### View all releases for an auction
```sql
SELECT
  au.name            AS manager,
  r.player_id,
  r.release_type,
  r.purchase_price,
  r.refund_amount,
  r.created_at
FROM auction_releases r
JOIN auction_users au ON au.id = r.auction_user_id
WHERE r.auction_id = <auction_id>
ORDER BY r.created_at DESC;
```

### Check which managers have used their paid release
```sql
SELECT name, paid_release_used, budget_remaining
FROM auction_users
WHERE auction_id = <auction_id>
ORDER BY name;
```

### Manually void a release (edge case / error correction)
There is no automated undo for a release. If a release needs to be reversed:
1. Re-insert the `auction_teams` row with the original `purchase_price`
2. Set the lot back to `status = 'sold'`
3. Deduct the refund from `budget_remaining` and `active_budget` if it was a paid release
4. Set `paid_release_used = false` if appropriate
5. Delete the row from `auction_releases`

All of these are direct SQL operations in Supabase SQL Editor.
