# Ops: Participant UI surfaces (stable product)

**Canonical map of what participants see.**  
Goal: **UI stays stable across competitions**; competition data changes, chrome does not.

Related: [OPS_INDEX.md](./OPS_INDEX.md), [ENTITY_INTERCONNECT_PLAN.md](./ENTITY_INTERCONNECT_PLAN.md).

**Page-level specs (canonical):** [ui-contracts/AUCTION_PAGES.md](./ui-contracts/AUCTION_PAGES.md) — current state (squads, budgets, bids) · [ui-contracts/LEADERBOARD.md](./ui-contracts/LEADERBOARD.md) — everything scoring. The two surfaces never mix.

---

## Design rule

For a new auction (Premier League, etc.):

- **Reuse** these routes and components.
- **Do not** invent a parallel dashboard, a second bidding room, or a one-off leaderboard layout mid-season.
- Competition-specific **content** (match sheets, archived IDs, history years) goes in data/config — not new page trees — unless product explicitly expands the system.

---

## Post-login shell

Top nav ([`ParticipantNav`](../app/_components/ParticipantNav.tsx)):

| Tab | Route | Purpose |
|-----|-------|---------|
| **Active Auctions** | `/dashboard` | Current leagues + join code |
| **Archives** | `/archives` | Completed leagues → Leaderboard / Match scores / Open auction |
| **Auction History** | `/auction-history` | Tabs: **Past Finishes** (rank + year; podium medals 🏆🥈🥉) and **Trophy Cabinet** (1st-place only — large trophy image + auction name; empty state if none) |
| Rules | `/rules` | Plain link |

`/match-scores` still exists but is unlinked from the top nav (removed Oct 2026 on request).
Shell cards (Active / Archives / History) share `app/_components/AuctionCard.tsx`; admin cards use the rose tone.

Archive status / history years: `lib/archived-auctions.ts`  
(an auction is archived when its competition's `competitions.status = 'archived'`; `AUCTION_HISTORY_YEARS` separately drives Past Finishes — finished auctions can stay Active until their competition is archived.)  
History ranks: `lib/scoring/auction-history.ts` (from `auction_leaderboard`)  
Manual Trophy Cabinet cups: `lib/scoring/trophy-cabinet-awards.ts`

### Active Auctions page contents (standard)

1. **Your auctions** (active only — archived filtered out)
2. **Join an auction**
3. Create auction (coming soon — leave disabled until built)

Removed / parked: large Match Scores card; Meme Builds entry (routes may still exist unused).

---

## Inside an online auction (`/auctions/[auctionId]/…`)

| Area | Notes |
|------|--------|
| Header | Auction name; deadlines (full width); Dashboard / Announcements / Refresh |
| **Side menu** | Navy (`slate-900`) with white text so it reads as a menu (Oct 2026): thin left rail with "☰ MENU" (desktop) or a navy "☰ MENU" pill (mobile; content `pt-16` keeps the title clear) + navy overlay drawer (`AuctionSideNav`): Bidding room (+ Fixtures modal when configured), My team, Announcements, Competitors – Bidding, Bids held, Transfer Room, Match scores, Leaderboard |
| **Bidding room** | Lot list, filters, deadlines, bid forms; sticky Team Name + Remaining / Disposable budgets (**Bidding room and My team only**) |
| **My Team** | Squad + release buttons |
| **Bids held** | Current high bids |
| **Competitors – Bidding** | Other managers’ **current** squads, budgets and bids. Not points — those are Leaderboard → **Competitors – Points** |
| **Player page** | Ownership, GW points, bid/release history, bid form |
| **Match scores** | In-auction sheets; player names → player page |
| **Announcements** | Sales, releases, eliminations (header button for now) |
| **Transfers** | Propose / respond (when window open) |
| **Leaderboard** | `/auctions/[id]/leaderboard` — Standings · My Points · Competitors – Points (locked GW squads, points, Best XI, formation). Legacy `/leaderboard/[id]` redirects here |

### Mobile auction chrome (validated — keep)

Validated on production phones (EPL auction UI pass, Aug 2026). Treat as the default unless product explicitly revisits it.

| Decision | What works | Implementation |
|----------|------------|----------------|
| **No permanent left gutter on phones** | A full-height rail + content `padding-left` made the bidding room feel narrow / “zoomed in.” | Mobile: floating menu button only (`AuctionSideNav`). Desktop (`sm+`): thin left rail + content offset. |
| **Overlay drawer** | Same open/close model on phone and desktop (tap/click; backdrop + Escape; closes on navigate). No hover-open in v1. | `AuctionSideNav` overlay |
| **Compact scale** | Slightly smaller UI so more lots fit; users can pinch-zoom if needed. | `.auction-mobile-compact { zoom: 0.88; }` under `max-width: 767px` in `app/globals.css` (class on auction layout content). **Do not raise toward 1.0 without checking phones.** Nudge only if product asks (e.g. `0.85` / `0.92`). |
| **Dense bidding list** | Smaller mobile lot cards, tabs, filters, and bid controls; desktop table unchanged. | `BiddingRoomClient`, `BidRowForm`, bidding-room page padding |
| **Budget strip scope** | Team Name / Remaining / Disposable on the Bidding room and My team only (not Leaderboard, Competitors, etc.). | `AuctionBudgetStrip` pathname gate |
| **Deadlines full width** | Putting deadlines in a `flex-1` column beside Dashboard / Announcements / Refresh squeezed the date into one-word-per-line wraps. | Header stacks: title + actions on one block; **deadlines below at full width**. `AuctionDeadlines`: mobile = label above value; `sm+` = three columns. |
| **New pages → side menu** | See [New in-auction pages](#new-in-auction-pages-required) above. | `AuctionSideNav` |

**Avoid regressing to:** permanent mobile left rail that steals width; deadlines sharing a narrow column with header actions; mobile `text-base` / tall cards without the compact zoom.

### New in-auction pages (required)

Any **new participant-facing page** inside an online auction must:

1. Live under `/auctions/[auctionId]/…` so it inherits auction chrome (`layout.tsx` + left rail).
2. Be added to the **left side menu** in [`AuctionSideNav.tsx`](../app/auctions/_components/AuctionSideNav.tsx) (label + href + active-match rules).
3. Be listed in the table above and in the matching UI contract ([AUCTION_PAGES.md](./ui-contracts/AUCTION_PAGES.md) or [LEADERBOARD.md](./ui-contracts/LEADERBOARD.md)) when it becomes a standard surface.

Do **not** add a parallel top/horizontal nav, a one-off header-only link, or a page that participants can only reach by URL. Header actions (Dashboard, Announcements, Refresh) are reserved for chrome utilities — new *sections* go in the side menu. Dev-only tools (e.g. Auction Lab) stay unlinked from participant nav.

### Deadlines presentation

| Mode | UI |
|------|-----|
| `global` | `AuctionDeadlines.tsx` — **full width under** title/actions (not beside them). Mobile: label above each date. `sm+`: three columns. |
| `nation_rolling` | Nation schedule control (`NationRollingDeadlinesButton.tsx` + `lib/auction-state/nation-deadlines-data.ts`) |

### Acting-as

Commissioners / dual seats: `ActingAsPicker` — act as a manager or **view only (no bidding)**. Cookie-based actor resolution in `lib/auction-state/auction-dashboard.ts`.

### Relegated banner

View-only messaging when `is_relegated` — do not hide the whole auction.

---

## Leaderboard presentation (`/auctions/[auctionId]/leaderboard`)

**Canonical layout contract (agents must follow):** [ui-contracts/LEADERBOARD.md](./ui-contracts/LEADERBOARD.md).  
**Scoring / Match Pos / formation ops:** [OPS_SCORING_AND_LEADERBOARD.md](./OPS_SCORING_AND_LEADERBOARD.md).

Live URL uses auction chrome (`/auctions/…/leaderboard`); `/leaderboard/[auctionId]` redirects. Do not redesign this surface unless the user explicitly asks. Extra gameweeks only add dropdown options.

| Tab / element | Behaviour |
|---------------|-----------|
| **Standings** | Season rank + points from `auction_leaderboard` sums. Relegated managers stay listed and flagged. |
| **My Points / Competitors** | One gameweek at a time via a **dropdown** (not a tab per GW). Default = latest GW with scores uploaded. Table: Player, Club, Listed Pos, Match Pos, Score. Season total is a small header box only. |
| **Best XI** | After publish for that GW: Starting XI + **formation** + substitutes (`GwSquadTable` / `GameweekSquadView`). Formation requires committed `data/best-xi/auction-{id}-gw{legacyGwId}.json`. Match Pos requires competition FinalPoints sheets deployed. |

Do not add per-GW score columns or endless tabs. World Cup GW **tabs** must not reappear on later auctions.

---

## Match scores

- **Public (canonical):** `/match-scores` (grouped by GW) — anyone; player names are plain text
- **In-auction:** `/auctions/[auctionId]/match-scores` — members only (incl. archived if still a member); same sheets; player names link to `/auctions/[auctionId]/players/[playerId]`
- Legacy redirects: `/scores/[slug]` → public match-scores
- Data: `data/competitions/<slug>/match-scores/*_FinalPoints.csv`, listed in `data/competitions/<slug>/sheets.json` (loaded by `lib/scoring/match-scores/sheets.ts`); each gameweek is one tab
- Same FinalPoints `position` column powers leaderboard **Match Pos** (via `loadMatchPositionsForGameweek`)

When a competition ends, **keep** its sheet file and CSVs registered — archived auctions’ match-score pages and Match Pos still read them. Keep the **routes** for the next season’s sheets.

---

## WC-era / later UI decisions to keep as standard

These were validated in production and should be the default for future seasons unless product explicitly revisits them:

1. Split **Active / Archives / History** instead of one mixed “Your auctions” list  
2. Archives deep-link to **leaderboard**, not bidding room  
3. History shows **ordinal finish + year** with podium emojis only for 1–3  
4. Match scores is **not** a dashboard card (top-nav link removed Oct 2026; per-auction access via Archives / side menu)  
5. Nation-rolling deadlines as a **dedicated control**, not fake global columns  
6. Leaderboard Best XI / bench split after publish  
7. **Left side menu** for in-auction sections (not horizontal tab strip) — see [Mobile auction chrome](#mobile-auction-chrome-validated--keep)  
8. Mobile: floating menu + `zoom: 0.88` compact chrome; deadlines full width (label above value)  

---

## What not to improvise mid-auction

- New in-auction pages **without** a left-menu entry in `AuctionSideNav`  
- New top-level (post-login) nav items without updating `ParticipantNav` + middleware auth matcher  
- One-off pages under `/scores` that bypass `sheets.ts`  
- Hardcoded participant names in UI components  
- CSS/theme rewrites during a live GW  
- Mobile layout regressions called out under [Mobile auction chrome](#mobile-auction-chrome-validated--keep) (permanent phone rail, squeezed deadlines, dropping compact zoom without review)  

Document intentional UI changes here when they become the new standard.
