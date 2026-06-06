# Announcements Feed

Last updated: June 2026

---

## What it is

The Announcements page is a **shared, read-only news feed** visible to every participant in an online auction. It surfaces three types of events in reverse-chronological order (most recent first):

| Event type | Triggered by |
|---|---|
| **Buy** | A player's lot is finalised and won by a manager |
| **Release** | A manager releases a player from their squad (paid or free) |
| **Transfer** | A peer-to-peer transfer between two managers reaches `completed` status |

The page is **static on load** — data is fetched fresh every time the page is visited. There is no real-time polling or push subscription.

---

## URL and navigation

- **Route:** `/auctions/[auctionId]/announcements`
- **Button:** A dark "Announcements" button (with a newsreel icon) sits in the top-right of the auction header, alongside the Dashboard link and Refresh button. It is **not** a nav tab — it intentionally sits above the tab strip.
- **Back button:** A `← Back` button at the top of the page content uses `router.back()` to return to wherever the user came from.

---

## Visual design

Each announcement type has its own colour and icon to make the feed easy to scan:

| Type | Colour | Icon | Example message |
|---|---|---|---|
| Buy | Emerald green | Currency/coin | *"Trive signed Bruno Fernandes for £42m"* |
| Release | Amber/orange | Exit-door arrow | *"Trive released Bruno Fernandes — paid release, £21m received back"* |
| Transfer | Sky blue | Double arrows | Two-panel card: what each manager gave |

Timestamps are shown on every card in the user's **local timezone**, formatted as `4 June 2026, 01:14 am` (en-GB locale, unambiguous month name).

---

## Data sources

All three event types are sourced from existing audit/transaction tables. No new database tables or columns are required.

### Buy events — `auction_teams`

`auction_teams` has no `created_at` column. The **timestamp used is the `created_at` of the last `auction_bids` row for that `(auction_id, player_id)`** — i.e. the moment the winning bid was placed. This is a reliable proxy because:
- The winning bid is always the final bid.
- Lots can only be finalised once, so the last bid is always the winner's.

Fields shown: buyer name, player name, position, price paid.

### Release events — `auction_releases`

The `auction_releases` audit table records every release with a `created_at` timestamp. Fields shown: releasing manager, player name, position, release type (`paid` / `free`), original purchase price, refund amount received.

### Transfer events — `auction_transfers`

Only rows with `status = 'completed'` are shown. The `completed_at` column is used as the timestamp. Fields shown: both managers' names, players each side gave, cash each side gave, and the auto-generated `summary` text (as fallback for cash-only deals).

---

## Code files

| File | Purpose |
|---|---|
| `lib/announcements.ts` | Server-only data layer. Fetches all three sources in parallel, enriches with player/manager names, merges, and sorts newest-first. |
| `app/auctions/[auctionId]/announcements/page.tsx` | Server component. Calls `loadAnnouncements` and renders the card list. |
| `app/auctions/[auctionId]/announcements/_components/BackButton.tsx` | Thin client component wrapping `router.back()`. |
| `app/auctions/[auctionId]/layout.tsx` | Layout where the Announcements button was added to the header. |

---

## `loadAnnouncements` function

```
lib/announcements.ts → loadAnnouncements(auctionId: number): Promise<Announcement[]>
```

**Fetch pattern (2 rounds, parallelised within each):**

Round 1 — three parallel queries:
1. `auction_teams` — all rows for this auction
2. `auction_releases` — all rows for this auction, ordered by `created_at desc`
3. `auction_transfers` — all completed rows for this auction, ordered by `completed_at desc`

Round 2 — three parallel enrichment queries (using IDs collected in round 1):
1. `players` — player names and positions
2. `auction_users` — manager display names
3. `auction_bids` — last bid per player (for buy timestamps), ordered by `created_at desc`

Results are merged into a single `Announcement[]` array and sorted by `timestamp` descending.

**Return types:**

```ts
type BuyAnnouncement = {
  type: "buy";
  timestamp: string;
  playerId: string;
  playerName: string | null;
  playerPosition: string | null;
  buyerName: string | null;
  price: number;
};

type ReleaseAnnouncement = {
  type: "release";
  timestamp: string;
  playerId: string;
  playerName: string | null;
  playerPosition: string | null;
  ownerName: string | null;
  releaseType: "paid" | "free";
  purchasePrice: number;
  refundAmount: number;
};

type TransferAnnouncement = {
  type: "transfer";
  timestamp: string;
  summary: string | null;
  proposerName: string | null;
  recipientName: string | null;
  proposerPlayers: PlayerMeta[];
  recipientPlayers: PlayerMeta[];
  proposerCash: number;
  recipientCash: number;
};
```

---

## Scope

- **Online auction only.** The live auction (`/live-auction/*`) is not covered. The live auction has its own sale/void model and a separate participant table; it would require a separate feed if ever needed.
- **All participants.** The feed is not filtered by the logged-in user — it shows all events across all participants.
- **All time.** There is no date cap or pagination; every event since the auction started is shown. For large auctions with many transactions this could be revisited with a limit/pagination approach.
