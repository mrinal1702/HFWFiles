# Entity interconnect plan (pages & links)

**Status:** Phase 1 done (deployed). Phase 2 implemented locally (rich player + in-auction scores). Phase 3 profiles started (`/u/[userId]` + competitor link).  
**Audience:** Humans and agents working on auction-app UI.  
**Related:** [OPS_UI_SURFACES.md](./OPS_UI_SURFACES.md), [USER_UI_AND_DEPLOYMENT.md](./USER_UI_AND_DEPLOYMENT.md), [AGENT_HANDOFF.md](./AGENT_HANDOFF.md)

---

## Product intent

Make the auction app feel like a real website: every meaningful name (manager, player, profile) is a hyperlink to a dedicated page. Managers can navigate from bidding room / leaderboard / anywhere into a competitor’s team, a player’s auction story, or another user’s HFW profile.

---

## Locked product rules

1. **Platform profiles** (`/u/[userId]`): any **signed-in** HFW user may view another user’s:
   - `display_name`
   - `avatar_url`
   - past auction finishes (archived tournaments only)
   - **Nothing else** (no email, budgets, live squads, private settings).
2. **Player pages**: stay **in-auction**. Enrich `/auctions/[auctionId]/players/[playerId]` for **auction members only**. No platform-wide football-player career page in this plan.
3. **Match scores**: public `/match-scores` stays public with plain player names. Members also get an **in-auction** copy under `/auctions/[auctionId]/match-scores` where player names link into that auction’s player pages.
4. **Phased delivery**: each phase below is independently deployable.

---

## What already exists (baseline)

| Surface | Route / code | Today |
|---------|----------------|-------|
| Competitor list + detail | `/auctions/[id]/competitors`, `.../competitors/[auctionUserId]` | Team + bids held; players link out |
| Player detail | `/auctions/[id]/players/[playerId]` | Thin: status, high bid, bid form |
| Bidding room | `BiddingRoomClient.tsx` | Player names link; **high bidder is plain text** |
| Leaderboard | `StandingsTable.tsx` | Manager names are **plain text** |
| Own history | `/auction-history` | Self-only finishes via `loadAuctionHistoryForUser` |
| Avatars | `profiles.avatar_url` + Storage `avatars` bucket | Dashboard upload only (`ProfileAvatar`) |
| Profiles RLS | `auth-and-join.sql` | Select/update **own** row only |

Key loaders/types: `lib/auction-dashboard.ts` (`CompetitorView`, `loadCompetitorView`), `lib/auction-history.ts`, `lib/leaderboard-data.ts`, `lib/auction-users-query.ts` (`user_id` on seats).  
SQL already supporting richer player pages: `auction_bids`, `auction_teams`, `auction_releases`, `player_scores`.

---

## Feasibility summary

| Ask | Feasible? | Notes |
|-----|-----------|--------|
| Click competitor from bidding / leaderboard → team + bids | Yes — mostly wiring | Destination already exists |
| Rich in-auction player page (owner, price, GW points, releases) | Yes — data exists | Page exists but thin |
| Click person → platform profile (avatar + finishes) | Yes — new route | Reuse history loader; field allowlist |
| Avatar chips + zoom on profile | Yes | Storage already public-read |
| Search people on the platform | Yes — new | Auth-gated `display_name` search |
| Search football players across all auctions | Out of scope | Player pages remain in-auction |

---

## Entity model (two identities)

Do **not** collapse these:

| Identity | ID | Page | Means |
|----------|-----|------|--------|
| **Auction seat** | `auction_users.id` | `/auctions/[auctionId]/competitors/[auctionUserId]` | What they’re doing in *this* league (team, bids, budget) |
| **Platform user** | `profiles.id` = auth uid (`auction_users.user_id`) | `/u/[userId]` | Who they are on HFW (avatar, name, past finishes) |

```mermaid
flowchart TD
  BidRoom[Bidding_room_Leaderboard_etc]
  CompPage["/auctions/id/competitors/auctionUserId"]
  PlayerPage["/auctions/id/players/playerId"]
  Profile["/u/userId"]
  BidRoom -->|"ManagerChip + avatar"| CompPage
  BidRoom -->|"PlayerChip"| PlayerPage
  CompPage -->|"PlayerChip"| PlayerPage
  CompPage -->|"View HFW profile if user_id"| Profile
  PlayerPage -->|"ManagerChip owner/bidder"| CompPage
  Profile -->|"finish row"| Leaderboard["/leaderboard/archivedAuctionId"]
```

**Chip behaviour inside an auction:** primary click → competitor page; secondary control “View HFW profile” when `user_id` is set.

---

## Shared UI primitives

Add once (suggested: `app/_components/entity/`):

1. **`ManagerChip`** — optional small avatar + name/team → competitor page when `auctionId` + `auctionUserId` known.
2. **`PlayerChip`** — player name → player route with `?returnTo=`.
3. **`ProfileChip` / `ProfileLink`** — avatar + name → `/u/[userId]`.
4. **`Avatar`** — sizes `xs` (inline tables), `sm`, `lg`; initials fallback; lightbox/zoom on profile page.

**Data:** join `auction_users.user_id` → `profiles.avatar_url` in auction user fetch / dashboard enrichment (extend `fetchAuctionUsers` / related). Avoid N+1 avatar queries in tables.

---

## Phase 1 — Manager links + avatars in auction

**Status: done (code).**

**Goal:** From bidding room, leaderboard, player “high bidder”, etc., clicking a manager name opens the same competitor page as the Competitors tab. Small avatars beside names.

**Shipped:**
- `app/_components/entity/Avatar.tsx`, `ManagerChip.tsx`
- `lib/profile-avatars.ts` + avatar join in `fetchAuctionUsers` / `fetchAuctionUserNames`
- `EnrichedLot.high_bidder_avatar_url`, `StandingEntry.avatarUrl`
- Wired: bidding room, standings, GW squad headers, competitors list/detail, player high bidder

**Deployable alone.** No new public profile routes required.

---

## Phase 2 — Rich in-auction player page + in-auction match scores

**Status: done (code).**

**Goal:** Inside an auction, click a footballer → full story **for this auction only** (membership gated by auction layout). Also give members an **in-auction Match Scores** entry point so a public-style sheet (e.g. France vs England) can deep-link into that player page (owner, points history, etc.).

### Locked rules for scores

| Surface | Who | Player names |
|---------|-----|----------------|
| **Public** `/match-scores` | Anyone (unchanged) | Stay **plain text** — no auction context, so no “who owns him” |
| **In-auction** `/auctions/[auctionId]/match-scores` | Auction members only | **Links** → `/auctions/[auctionId]/players/[playerId]?returnTo=…` |

Same sheet registry (`MATCH_SCORE_SHEETS` / CSV data) powers both; only the chrome and player-row behaviour differ.

### Shipped

- `lib/player-auction-detail.ts` — `loadPlayerAuctionDetail`
- Enriched `/auctions/[id]/players/[playerId]` — ownership, GW points, bid history, releases, bid form when in pool
- `/auctions/[id]/match-scores` + **Match scores** in `AuctionNav`
- Archives cards: Leaderboard / Match scores / Open auction (so archived leagues stay testable)

**Note:** When `MATCH_SCORE_SHEETS` is empty, the in-auction scores page shows the empty state; player pages still work from Competitors / Bidding room / sold lots.

---

## Phase 3 — Platform profiles + people search + avatar zoom

**Status: profiles done (code); people search still optional/later.**

**Goal:** Leave the auction into someone’s HFW page; enlarge avatar; easy **Back to auction**.

**Route:** `/u/[userId]?returnTo=…` — auth-gated in middleware.

**Page content (strict allowlist):**
- Large avatar (click → lightbox / zoom when photo exists)
- Display name
- Past finishes (archived only; same as Auction History)
- Finish rows → `/leaderboard/[auctionId]`
- **Back to auction** via `returnTo` (from competitor page)

**Entry points:** Competitor page — avatar + “View HFW profile” when `user_id` is set.

**Not in this slice yet:** people search hub.

---

## Phase 4 — Optional polish (later)

- From a profile finish, deep-link to that user’s archived competitor seat if resolvable
- Transfers / announcements use the same chips
- Live-auction participants where `user_id` maps
- Consistent avatar URL cache-busting in chips

---

## UI feel guidelines

- Names are links whenever a destination exists (same visual language as current player links in the bidding room).
- Avatars stay small inline in tables; full-size only on `/u/...` and competitor headers.
- Copy: **“View team”** (in-auction) vs **“View HFW profile”** (platform).
- Preserve `?returnTo=` so Back returns to bidding room / leaderboard / search / **in-auction match scores**.

---

## Explicit non-goals

- Platform-wide football player pages / cross-auction career
- Turning **public** `/match-scores` into auction-scoped ownership links (that stays global + plain player names)
- Anything on profiles beyond name, avatar, past finishes
- One-shot deploy of all phases
- Global app chrome redesign (feature-local shells are fine)

---

## Recommended build order

1. Primitives + avatar join + Phase 1 manager links — **done**
2. Phase 2b rich player detail → Phase 2a in-auction match scores (player links)
3. Phase 3 `/u/[userId]` + people search + lightbox
4. Phase 4 polish as needed  

---

## Agent notes

- Prefer extending existing competitor/player routes over inventing parallel pages.
- Keep auction membership checks for player detail; keep profile pages signed-in-only with a hard field allowlist.
- When implementing, update this doc’s **Status** line and tick phases done so future agents know what shipped.
