# Auction pages UI contract (current state)

**Status:** Canonical. Agreed Oct 2026; verified against production (auction 10) on 7 Oct 2026. Companion: [LEADERBOARD.md](./LEADERBOARD.md) (everything scoring).
**Product owner rule:** do not change layout, copy, columns or navigation unless the user
**explicitly** asks. After an explicit change ships, update this file in the same commit.

## The one rule

The participant UI has exactly two surfaces. Never mix them.

| | **Auction pages** (this contract) | **Leaderboard** ([LEADERBOARD.md](./LEADERBOARD.md)) |
|---|---|---|
| Question it answers | "What do I / my rivals have **right now**?" | "How did we **score**?" |
| Data | Live: `auction_teams`, `auction_lots`, `auction_bids`, `auction_users` budgets, transfers | Locked: `gameweek_squads`, `Player_Scores`, `auction_leaderboard`, Best XI overlays |
| Loaders | `lib/auction-state/*` | `lib/scoring/*` |
| Never shows | Gameweek points, Best XI, formations, past-GW squads, standings | Budgets, bids, timers, live squads |

If a request needs scores on an auction page, or budgets/bids on the leaderboard, **stop and ask**.

## Side menu (`app/auctions/_components/AuctionSideNav.tsx`) — fixed order and labels

1. **Bidding room** · 2. **My team** · 3. **Announcements** · 4. **Competitors – Bidding** ·
5. **Bids held** · 6. **Transfer Room** · 7. **Match scores** · 8. **Leaderboard**

(Fixtures appears as a modal under Bidding room when configured.) New in-auction pages must be
added here — see [OPS_UI_SURFACES.md](../OPS_UI_SURFACES.md).

## Pages

### Bidding room — `/auctions/[id]/bidding-room`
- Intro line ("You can see everyone's budgets, high bids, and rosters…") and a Refresh hint.
- Tabs: **All players · Ongoing bids · Unsold (no bids) · Sold · Search player**.
- **Filters & sort** panel (collapsed by default): club, position, status (All tab), bidder (Ongoing tab), **Sort**.
- Table columns: **Player · Club · Pos · State · High bid · High bidder · Lot deadline · Bid**
  (bid form, or the reason bidding is unavailable, e.g. full roster). High bidder links to their Competitors – Bidding page.
- Default sort **"Default (ongoing → unsold → sold)"**:
  1. Active `bidding` lots (auction still open), `expires_at` descending, tie-break `player_id`.
  2. Unsold / not sold (`uninitiated`, `unsold`, or `bidding` after close): `players.team_id` ↑,
     then position GK → DEF → MID → FWD → other (`positionSortRank()` in
     `lib/auction-state/bid-ui-messages.ts`), then `player_id`.
  3. Sold: same secondary order as (2).
  Other sort options (deadline, bid high/low) override for manual analysis.
- Sticky **Playing as / Remaining / Active** budget strip — **Bidding room and My team only**.
- Player names link to the player page; after a bid the same row scrolls back into view.
- Bid error copy is centralised in `lib/auction-state/bid-ui-messages.ts` + `auction-bid-gates.ts`.

### My team — `/auctions/[id]/team`
Budget strip, intro line, **Players purchased: N**, then the current owned squad grouped by
position (Goalkeepers / Defenders / Midfielders / Forwards). Columns: **Player · Club · Pos · Price · Release**.
Release buttons per OPS_RELEASES. Current bids live under Bids held, not here.

### Bids held — `/auctions/[id]/bids-held`
Intro line, then my current high bids — columns **Player · Club · Pos · Your bid · Timer (local)** —
or the empty state "You're not winning any bids at the moment.", plus slot counts
**Players owned (n/18) · Bids held · Can still bid on**.

### Competitors – Bidding — `/auctions/[id]/competitors` and `/competitors/[auctionUserId]`
- List: intro line, then columns **Manager · Remaining · Active · Players purchased · Bids held**.
- Detail: back link "← Competitors – Bidding", manager identity + "View HFW profile", stats
  **Remaining · Active · Players owned (n/18) · Bids held · Can still bid on**; **View Team**
  ("Players they've won in this auction") grouped by position — **Player · Club · Pos · Price**;
  **Bids they're winning** — **Player · Club · Pos · Bid · Timer (local)**, or "None right now."
- **No points, gameweeks or formations here.** Those are on Leaderboard → Competitors – Points.

### Transfer Room, Announcements
See [TRANSFER_ROOM.md](../TRANSFER_ROOM.md) and [ANNOUNCEMENTS.md](../ANNOUNCEMENTS.md).

### Match scores — `/auctions/[id]/match-scores`
Per-match FinalPoints sheets for the auction's competition (grouped by matchweek). Match data,
not manager scoring; player names link to the player page.

### Player page — `/auctions/[id]/players/[playerId]`
The one deliberate cross-over. Sections: lot status (state, high bid, high bidder, lot timer) with
← Back / Back to search / Match scores links; **Place a bid**; **Points this auction** (that
player's scores for **this auction's gameweeks only**, + Total); **Bid history**; **Ownership & releases**.
It never shows a manager's squad points.

## Chrome (unchanged)
Light white + sky theme, `max-w` shell, header with auction name and full-width deadlines,
mobile compact zoom 0.88 — see "Mobile auction chrome" in [OPS_UI_SURFACES.md](../OPS_UI_SURFACES.md).
