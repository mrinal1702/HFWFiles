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

Shown in CAPITALS (styling only), and each page's main heading is capitalised to match.
(Fixtures appears as a modal under Bidding room when configured.) New in-auction pages must be
added here — see [OPS_UI_SURFACES.md](../OPS_UI_SURFACES.md).

## Pages

### Bidding room — `/auctions/[id]/bidding-room`
- Heading **Bidding room** with an info icon (hover on desktop / tap on phone) explaining the page
  (copy in `bidding-room/page.tsx`); no intro paragraph. Refresh hint above the list.
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
- Player rows are separate cards tinted by position (GK / DEF / MID / FWD); the colour convention
  lives in `POSITION_THEME` in `app/auctions/_components/position-theme.tsx` (shared with My team). Position tag and State pill stay.
- Squad cap reached: Bid column reads **"You are at the squad limit"** + info icon
  (`SQUAD_LIMIT_REASON` / `SQUAD_LIMIT_HELP` in `lib/auction-state/squad-limit.ts`).
- Bid amount box never narrower than ~5.5rem and 16px text on phones (no iOS zoom-on-focus).
- Sticky **Team Name / Remaining / Disposable** budget strip with an info icon (copy in
  `lib/auction-state/budget-copy.ts`; "Disposable" = DB `active_budget`) — **Bidding room and My team only**.
- Player names link to the player page; after a bid the same row scrolls back into view.
- Bid error copy is centralised in `lib/auction-state/bid-ui-messages.ts` + `auction-bid-gates.ts`.

### My team — `/auctions/[id]/team`
Budget strip, then a header card with stat tiles **Players purchased** and **Winning bids held**
(same rule as Bids held; no intro paragraph), then the current owned squad grouped by position
(Goalkeepers / Defenders / Midfielders / Forwards, with counts) as separated cards tinted by position
(shared `app/auctions/_components/position-theme.tsx`). Columns: **Player · Club · Pos · Price · Release**.
Release buttons per OPS_RELEASES. Current bids live under Bids held, not here.

### Bids held — `/auctions/[id]/bids-held`
Header card: **Bids held** + info icon (no intro paragraph) and slot counts
**Players owned (n/18) · Bids held · Can still bid on**; then my current high bids as position-tinted
cards (`LeadingBidsList`, shared with Competitors detail) — columns **Player · Club · Pos · Your bid ·
Timer (local)** — nothing listed below the header when there are none.

### Competitors – Bidding — `/auctions/[id]/competitors` and `/competitors/[auctionUserId]`
- List: heading with an info icon (no intro paragraph), then managers as separated cards — columns
  **Manager · Remaining · Disposable · Players purchased · Bids held**.
- Detail: back link "← Competitors – Bidding", manager identity + "View HFW profile", stats
  **Remaining · Disposable · Players owned (n/18) · Bids held · Can still bid on**; **View Team**
  ("Players they've won in this auction") grouped by position — **Player · Club · Pos · Price** —
  same layout as My team (`SquadByPosition`); **Bids Held by <competitor>** + info icon — **Player · Club ·
  Pos · Bid · Timer (local)** as position-tinted cards like the Bidding room (nothing listed when none).
- **No points, gameweeks or formations here.** Those are on Leaderboard → Competitors – Points.

### Transfer Room, Announcements
See [TRANSFER_ROOM.md](../TRANSFER_ROOM.md) and [ANNOUNCEMENTS.md](../ANNOUNCEMENTS.md).

### Match scores — `/auctions/[id]/match-scores`
Per-match FinalPoints sheets for the auction's competition — **one tab per gameweek**; a **match
dropdown** (blank by default — no scores until a match is chosen; `?match=<slug>` preselects it) lists
that gameweek's matches. A new gameweek appears as a new tab automatically when its matches are
scored (`data/competitions/<slug>/sheets.json`). Rows are separated cards tinted by **match position**
(the FinalPoints `position`, i.e. where they played in that match — may differ from the listed
position). Match data, not manager scoring; player names link to the player page.

### Player page — `/auctions/[id]/players/[playerId]`
The one deliberate cross-over. Sections: lot status (state, high bid, high bidder, lot timer) with
← Back / Back to search / Match scores links; **Place a bid**; **Points this auction** (that
player's scores for **this auction's gameweeks only**, + Total); **Bid history**; **Ownership & releases**.
It never shows a manager's squad points.

## Lobby (self-serve auctions before Start Bidding)

While `"Auctions".status = 'setup'`, the in-auction layout (`app/auctions/[auctionId]/layout.tsx`)
renders `ParticipantLobby` (`app/auctions/_components/ParticipantLobby.tsx`) **in place of every
page** — no side menu, deadlines or budget strip. It shows: auction name + Dashboard link, a
"Waiting for <commissioner> to start bidding" card (info icon + Rules link), the participant code
with Copy, and the joined managers (`app/_components/lobby/LobbyMembers.tsx`). A commissioner
without a seat is redirected to their admin lobby. Once Start Bidding is pressed the normal pages
appear at the same URLs. The admin side (`/auction-admin/[id]`) likewise shows `AdminLobby` instead
of the admin menu and tools, and `requireAuctionAdmin` refuses admin tool actions in the lobby.

## Chrome
Navy side menu; navy→blue gradient header banner with the auction name; full-width deadline tiles;
mid-blue page backdrop with white cards; display font for titles and names; mobile compact zoom 0.88.
Details: "Visual theme" and "Mobile auction chrome" in [OPS_UI_SURFACES.md](../OPS_UI_SURFACES.md).
