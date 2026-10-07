# In-auction pages

Two surfaces live under this folder. Know which one you are editing:

- **Auction pages** (everything here except `leaderboard/`) show the **current state**: squads,
  budgets, bids, transfers. Contract: `auction-app/docs/ui-contracts/AUCTION_PAGES.md`.
  Data from `lib/auction-state/`. **No gameweek points, Best XI, formations or past squads.**
- **`leaderboard/`** shows **everything scoring**. Contract: `auction-app/docs/ui-contracts/LEADERBOARD.md`
  (see `leaderboard/CLAUDE.md`).

Names: side-menu **"Competitors – Bidding"** (`competitors/`) = rivals' current squads, budgets,
bids. Leaderboard tab **"Competitors – Points"** (`leaderboard/competitors/`) = rivals' locked GW
squads and points. They are different pages; never merge or cross-link their content.

Do not change layout, labels, columns or menu order unless the user explicitly asks; if they do,
update the contract in the same commit. New pages must be added to `AuctionSideNav`.
