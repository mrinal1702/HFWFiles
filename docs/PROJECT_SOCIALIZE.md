# Project Socialize — plan & backlog

**Objective:** turn HFW from a place where people play auctions into a social fantasy football
home: people follow friends, watch their auctions, share results into WhatsApp and build a
lasting HFW history. WhatsApp stays the conversation channel; HFW becomes where the fantasy
activity lives.

**Guiding principle:** breadth first, complexity later, functionality before perfection. Get
~70% of the building blocks working quickly, then perfect them.

Started: 6 Nov 2026. Project Self-Sufficiency (`docs/SELF_SUFFICIENCY_AUDIT.md`) is paused while
Socialize gets its foundations in; its open items are held, not dropped.

**Status:** ✅ done · 🟡 partly done · ⬜ open · ⏸ deferred · ❓ decision needed.

---

## Ground rules

- **Active auctions are not disturbed.** UCL 2026/27 (competition 4, auctions 10–13) keeps its
  bids, squads, scores, standings and settings unless the owner explicitly approves a specific
  change, proven with before/after checks.
- **Reuse before building.** Extend `profiles`, `/u/[userId]`, the Trophy Cabinet, the auction
  pages and the spectator banner rather than creating parallel systems. No new infrastructure or
  dependencies without a clear reason (`next/og` ships with Next.js and is fine).
- **One permission gate.** Every spectator / guest read goes through a single `canViewAuction()`
  helper. The app reads with the service-role key, so this helper — not RLS alone — is the real
  safeguard. New tables still enable RLS (`scripts/sql/README.md`) and get explicit grants.
- **Spectators never act.** Bid, release, transfer and admin actions keep resolving a seat from
  `auction_users` and rejecting anyone without one. Spectator UI hides those controls too.
- **Public data allowlist.** Guests and other users only ever see display name, avatar,
  auction results and what participants already see inside a visible auction. Never emails,
  auth data or private settings.
- **Contracts stay law.** Changes to auction pages or the leaderboard update
  `auction-app/docs/ui-contracts/*` in the same commit.
- Small, testable steps; preview on localhost before committing; commit to `main` deploys.

---

## Decisions log

| Date | Decision |
|---|---|
| 6 Nov 2026 | **No usernames for now.** People keep their real display names; search is by display name. Names aren't unique, so results show avatar + auctions played to tell people apart. |
| 6 Nov 2026 | **Spectators see everything a participant sees**, including live bids, bids held and budgets — nothing in an auction is secret from its participants, so nothing is hidden from spectators. |
| 6 Nov 2026 | **New auctions default to private.** |
| 6 Nov 2026 | **One-way follows (Instagram-style)**, not friend requests. No approval needed to follow. |
| 6 Nov 2026 | **Profiles are public**, including to logged-out guests. |
| 6 Nov 2026 | **Pre-website winners (2015 onwards) will be imported** into trophy cabinets — later; it's long data entry. The trophy data model must allow it. |
| 6 Nov 2026 | **The demo auction is a real auction, opened publicly with names shown.** Little personal data, low traffic. |
| 6 Nov 2026 | **Self-Sufficiency items stay on hold** (incl. T1 `/auction-lab`, S1 privacy/terms); revisit soon. |
| 10 Nov 2026 | **Build order reworked: base first, then cheapest high-value wins** (see "Build order"). Tier 0 = the access base (V-6, V-1 + V-2). |
| 10 Nov 2026 | **Visibility starts as `private` / `public` only.** Both Q1 options share these two ends, so Q1 no longer blocks V-1; a middle level can be added later by widening the check constraint. |
| 10 Nov 2026 | **An auction's admin without a seat can view it** (view only), via `canViewAuction()`. |
| 6 Nov 2026 | Chat / messaging deferred (Phase 5); public chat never ships without moderation, blocking and reporting. |

## Open decisions

| # | Question | Options | Lean |
|---|---|---|---|
| Q1 | Auction visibility **middle level** — with one-way follows, "visible to followers" means "anyone signed in". `private` / `public` ship now (10 Nov 2026); decide the middle level only when it's needed. | (a) private / signed-in / public · (b) "friends" = mutual follows: private / friends / public | — (decide at V-1) |
| Q2 | Which auction is the public demo | Archived (e.g. WC 2026 auction 5: finished story, winner, trophies) · a live UCL auction 10–13 (more compelling; needs explicit owner OK + before/after checks) | — |
| Q3 | Who builds | Cursor prompts (brief §9) · built in Claude Code with localhost preview · mix | — |

---

## What exists today (6 Nov 2026)

| Area | Today |
|---|---|
| Profiles | `profiles` (`id`, `display_name`, `avatar_url`). `/u/[userId]` shows avatar, past finishes and a Trophy Cabinet, via `lib/public-profile.ts` (service role + field allowlist). Login required. |
| Spectators | ~~`lib/auction-spectators.ts` hard-coded map~~ → `lib/auction-access.ts` + `auction_spectators` table (10 Nov 2026). `app/auctions/[auctionId]/layout.tsx` shows a "Spectator — view only" banner. Actions reject users without a seat. |
| History / trophies | `lib/scoring/auction-history.ts`, `lib/scoring/trophy-cabinet-awards.ts`; driven by code constants `AUCTION_HISTORY_YEARS` (`lib/archived-auctions.ts`) and `MANUAL_TROPHY_AWARDS` (same as audit F12). |
| Sharing | None — no share buttons, no Open Graph metadata. |
| Guests | Landing page only. `middleware.ts` forces login on `/auctions/*`, `/u/*`, dashboard etc. |
| ~~Known gap~~ fixed 10 Nov 2026 | **Acting-as fallback** (audit I4, `app/auctions/_components/ActingAsPicker.tsx`): without a login, the bid action can fall back to the auction's first manager. The login redirect is what currently prevents a guest from reaching it. |

---

## Milestones

Phase boundaries are flexible: an easy, high-value item may move earlier; a hard one is deferred
rather than blocking the rest. Each item is "initially complete" when the core experience works,
permissions are correct and nothing existing breaks.

### M1 — Social foundations

| # | Item | Simplest useful version | Reuses | Status |
|---|---|---|---|---|
| S-1 | Follows | `follows` table (follower_id → followed_id, unique pair, no self-follow, RLS on). Follow / Unfollow button on `/u/[userId]`; Following and Followers lists. | `profiles`, `/u/[userId]` | ⬜ |
| S-2 | People search | Search by display name (case/accent-insensitive, like the player search). Results: avatar, name, auctions played → profile. | Accent-insensitive search from `5c15ae6` | ⬜ |
| S-3 | Profile stats | Auctions played, wins, podiums on the profile; list of the user's current auctions (only those the viewer may see). | `loadAuctionHistoryForUser`, Trophy Cabinet | ⬜ |
| S-4 | Event log (seed for the feed) | `activity_events` table written when something happens (joined / created an auction, won, notable signing, moved to 1st). No UI yet. | Existing write paths | ⬜ |
| S-5 | Navigation | One coherent entry point (e.g. "People" / "Following" in the post-login shell) — no duplicated menus. | Dashboard shell | ⬜ |

### M2 — Visibility and spectators

| # | Item | Simplest useful version | Depends on | Status |
|---|---|---|---|---|
| V-1 | Auction visibility | `Auctions.visibility` (`private` / `public`), default `private` — `scripts/sql/auction-visibility.sql`. Existing auctions stay `private`. **Admin toggle in `/auction-admin` still open** (comes with V-8). | — | 🟡 |
| V-2 | `canViewAuction()` | `lib/auction-access.ts` (`getAuctionAccess` / `canViewAuction`): seat → participant; admin → view only; `auction_spectators` row or public → spectator; else none. Used by the auction layout. Hard-coded map migrated. | V-1 | ✅ |
| V-3 | Spectator view | Existing auction pages, read-only: hide bid inputs, release, transfer controls; keep the banner. Server-side rejection stays. | V-2 | ⬜ |
| V-4 | Dashboard split | My Auctions = seats (and admin cards) only. Watched auctions are reached via profiles, Following and Discover. | V-2 | ⬜ |
| V-5 | Discover | Simple list of public auctions (name, competition, managers, leader). | V-1 | ⬜ |
| V-6 | Remove acting-as fallback | Bid action never falls back to another manager without a login (audit I4). Picker + `auction_actor` cookie deleted. **Prerequisite for V-7.** | — | ✅ |
| V-7 | Guest access | Middleware lets logged-out visitors open public auctions and profiles read-only; "Join HFW" prompt. | V-2, V-3, V-6 | ⬜ |
| V-8 | Demo auction | Set one real auction public. | Q2, V-7 | ⬜ |

### M3 — Sharing and achievements

| # | Item | Simplest useful version | Status |
|---|---|---|---|
| H-1 | Share button | One component: native share sheet (`navigator.share`), WhatsApp link fallback, prepared message + link. On standings, gameweek results, team, profile, public auction. | ⬜ |
| H-2 | Link previews | Open Graph metadata + dynamic cards via `next/og` ("GW4: X leads on 412 pts"). May move earlier — cheap and high-value. | ⬜ |
| H-3 | Trophies from the DB | Wins / podiums derived from archived final standings; special cups as rows in a table; retire `MANUAL_TROPHY_AWARDS` / `AUCTION_HISTORY_YEARS` (closes audit F12). Model allows pre-website seasons. | ⬜ |
| H-4 | Shareable achievements | A trophy / result has its own shareable URL + preview. | ⬜ |

### M4 — Engagement (later)

| # | Item | Status |
|---|---|---|
| E-1 | Basic chronological feed of followed people, from `activity_events` | ⏸ |
| E-2 | Simple notifications | ⏸ |
| E-3 | Reactions | ⏸ |
| E-4 | Auction invite links (overlaps audit S5) | ⏸ |

### Deferred / backlog

- Usernames (decided against for now).
- Import of pre-website winners (2015 onwards) — data entry, after H-3.
- Mutual-follow suggestions, recommendations, richer discovery filters.
- Phase 5: direct messages, auction chat, public chat (needs moderation, blocking, reporting),
  advanced notifications, personalised feeds, advanced achievements, WhatsApp Business API.
- Held Self-Sufficiency items that become more urgent once pages go public: T1 (`/auction-lab`
  lock-down) and S1 (privacy policy / terms).

---

## Build order (reworked 10 Nov 2026)

Guidelines: build the base first; do what makes the rest easier; prefer the least effort for the
most progress. Fine-tuning comes later.

**Tier 0 — Base (access gate; no visible change)**
1. V-6 remove acting-as fallback ✅
2. V-1 + V-2 `visibility` column (private/public) + `canViewAuction()` 🟡 (SQL to apply)

**Tier 1 — Quick wins**
3. Public profiles (drop the login redirect on `/u/*`)
4. H-2 link previews, static first
5. H-1 share button
6. S-1 follows + S-2 people search + light S-3 profile stats

**Tier 2 — Opening auctions up**
7. V-3 read-only spectator view (hide controls)
8. V-7 guest access to public auctions
9. V-8 demo auction (Q2) + admin visibility toggle

**Deferred:** S-4 event log (until the feed is near), S-5 navigation (once 2+ social pages),
V-5 Discover, V-4 dashboard split, H-3 trophies from the DB, M4.

## Definition of done (initial scope)

1. Users have persistent, searchable profiles.
2. Users can follow friends.
3. Users can browse friends' permitted auctions and performances.
4. Spectating is distinct from participating.
5. Auction results and achievements stay visible historically.
6. Content is easy to share to WhatsApp.
7. Guests can see at least one public auction without registering.
8. The social pieces feel connected, not like unrelated pages.
9. Existing auction functionality is unchanged.
10. Basic security and privacy protections are in place.
