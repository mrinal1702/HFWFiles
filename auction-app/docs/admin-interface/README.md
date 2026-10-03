# Online Auction Admin Interface — working folder

> Scope: the **online** auction (`/auctions/*`) commissioner front-end.
> This is **not** the live-auction admin (`/live-auction/[id]/admin`), which is already built and used for recording verbal-auction sales.

This folder holds planning, spec, and context for the online-auction admin interface. Code will live under `app/auctions/[auctionId]/admin/` + related server actions/RPCs; this folder is the design + status source of truth.

**Origin chat:** [Build auction admin interface](c48dbdb5-e6fb-4ce7-8e99-f771e8e04401) (Jul 22 → Aug 8, 2026)
**Current chat:** `agent-transcripts/c31d86d4-4ed8-406c-abbb-3e0625abf4e3` (Oct 3, 2026)

---

## Where the admin user ID comes from

| Thing | Table / column | Notes |
|-------|----------------|-------|
| **Who the admin is** | `public."Auctions".admin_user_id` → `auth.users(id)` | One admin per auction (single column per row). A person **may** admin multiple auctions (non-unique lookup index). Added by `scripts/sql/auction-admin-column.sql`. `null` = no admin. |
| A participant's identity | `auction_users.user_id` → `auth.users(id)` | One "seat" row per participant per auction (`auction_users.id` is the seat id). Holds `name`, `budget_remaining`, `active_budget`. |
| User profile (display) | `profiles` (keyed on `auth.users.id`) | Name/avatar for a given auth user. |
| Owned players | `auction_teams` (`auction_id`, `auction_user_id`, `player_id`, `purchase_price`) | A participant's squad. |
| Lots (market state) | `auction_lots` (`auction_id`, `player_id`, `status`, `current_high_bid_id`, `current_high_bidder_id`) | `status`: `uninitiated` \| `bidding` \| `sold`. |
| Bids | `auction_bids` | Ongoing/historical bids per lot. |

**To make someone an admin:** set `Auctions.admin_user_id = <their auth.users UUID>`.
Find a person's auth UUID via `auction_users.user_id` (if they're a participant in that auction) or the `profiles` table.
Being admin and being a participant are independent: a seat in `auction_users` makes you a participant; `Auctions.admin_user_id` makes you the admin. Someone can be both (e.g. Conrad in the lab auction).

---

## Locked spec (from origin chat)

**Model**
- One admin per auction. Assigned manually in Supabase (`admin_user_id`) for now.
- A user can be admin-only, participant-only, or both.
- Dashboard "My Auctions" shows a second link `Admin - <Auction Name>` for the admin, opening the admin interface. Admin-only users see only the admin link.

**Admin powers**
- Add / remove players to/from participant teams.
- Add / remove budget. **Hard rules:** can never remove more than a participant's active budget; a participant can never go to negative budget.
- Cancel an ongoing bid — only while lot `status = bidding` (not after sold). Bid-history row can be dropped on cancel.
- Re-open a sold player: set a sold lot back to `uninitiated` / biddable again.
- Credit a player directly to a participant with an admin-set **"buy price"** (used for half-release refund / elimination value). On an admin credit, **budget is NOT deducted** — explicit admin override.

**Non-goals / cautions**
- Avoid cascading edits that "open a can of worms"; keep operations simple and auditable.

---

## Routes (built)

New isolated route group `app/auction-admin/[auctionId]/` (separate from the participant
`/auctions/*` layout, so it has its own header + menu and does not redirect admin-only users).

| Route | Purpose |
|-------|---------|
| `/auction-admin/[auctionId]` | Redirects to `/players` |
| `/auction-admin/[auctionId]/players` | Add/Remove landing — participant list |
| `/auction-admin/[auctionId]/players/[participantId]` | Team + budget profile, bids held, Add/Remove entry points |
| `/auction-admin/[auctionId]/players/[participantId]/add` | Free-agent list + filters → buy-price prompt |
| `/auction-admin/[auctionId]/players/[participantId]/remove` | Team list → confirm removal |
| `/auction-admin/[auctionId]/budget` | Modify Budget — Give / Take money per participant |
| `/auction-admin/[auctionId]/cancel-bids` | Cancel Bids — participant list |
| `/auction-admin/[auctionId]/cancel-bids/[participantId]` | That participant's held bids, each with Cancel bid |
| `/auction-admin/[auctionId]/transfers` | Menu placeholder ("Coming soon") |

Key files: `lib/online-auction-admin.ts` (admin auth + display name + squad grouping),
`app/auction-admin/[auctionId]/actions.ts` (`adminAddPlayerToTeam`, `adminRemovePlayerFromTeam`),
`middleware.ts` (added `/auction-admin/:path*`).

## Status

### Done
- Spec/decisions locked.
- **Add / Remove Players section built** (header = auction name + admin name; burger menu with all 4 items; participant list → profile → add/remove flows with Back at every step). Add enforces ≤1 GK and ≤18 players counting bids held; prompts for an admin-set buy price; **does not deduct budget**. Remove returns the player to the unsold pool as a free agent; **does not change budget**. Typecheck + lint clean.
- **Modify Budget section built**: participants listed with Remaining + Active budget and Give money / Take money buttons per row. Give adds to both budgets; Take subtracts from both and is blocked if it would push active (or remaining) budget below £0.
- **Cancel Bids section built**: participant list → their held bids → Cancel bid. Cancelling returns the lot to `uninitiated` (biddable) and credits the bid amount back to the bidder's `active_budget` (budget_remaining unchanged; previous bid is not restored).
- **Dashboard `Admin - <Auction>` links built** and deployed; admins assigned for auctions 10/11/12/13.
- Lab auction seeded: **"HFW Admin Lab"** (set via `AUCTION_LAB_AUCTION_ID` in `.env.local`) — participants Mrinal / Antonio / Conrad (Conrad = admin+participant), nations Argentina/France/England/Spain, random squads + budgets.
- Committed helpers:
  - `scripts/setup-admin-lab-auction.mjs` (seed/reset the lab auction)
  - `scripts/sql/auction-admin-column.sql` (adds `Auctions.admin_user_id` + one-admin-per-auction unique index)

### Not built yet
- Transfer Monitor section (placeholder only).
- Re-open sold player directly from the admin UI (today: remove returns them to free-agent pool).
- Confirm whether `auction-admin-column.sql` has actually been run on the live DB, and set `admin_user_id` per auction (10/11/12/13) — required before anyone can open the interface.

---

## Roadmap (agreed order)

1. **Build the admin interface** (the actual feature). ← current step
2. Add the dashboard `Admin - <Auction Name>` links.
3. Assign admins for the active UCL 26/27 auctions (**10, 11, 12, 13**) and define per-admin allowances.

> Build/test against the lab auction first, then point real online auctions at it.
