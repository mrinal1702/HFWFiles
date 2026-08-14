# Ops: Participant UI surfaces (stable product)

**Canonical map of what participants see.**  
Goal: **UI stays stable across competitions**; competition data changes, chrome does not.

Related: [USER_UI_AND_DEPLOYMENT.md](./USER_UI_AND_DEPLOYMENT.md), [OPS_INDEX.md](./OPS_INDEX.md), [ENTITY_INTERCONNECT_PLAN.md](./ENTITY_INTERCONNECT_PLAN.md).

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
| **Auction History** | `/auction-history` | Personal finishes (rank + year); podium medals 🏆🥈🥉 |
| Match scores | `/match-scores` | Public link (plain player names; no auction ownership) |

Archived auction IDs / history years: `lib/archived-auctions.ts`  
History ranks: `lib/auction-history.ts` (from `auction_leaderboard`)

### Active Auctions page contents (standard)

1. **Your auctions** (active only — archived filtered out)
2. **Join an auction**
3. Create auction (coming soon — leave disabled until built)

Removed / parked: large Match Scores card; Meme Builds entry (routes may still exist unused).

---

## Inside an online auction (`/auctions/[auctionId]/…`)

| Area | Notes |
|------|--------|
| Header / nav | Auction name; link back to dashboard |
| **Bidding room** | Lot list, filters, deadlines, bid forms |
| **My Team** | Squad + release buttons |
| **Bids held** | Current high bids |
| **Competitors** | Other managers’ squads |
| **Player page** | Ownership, GW points, bid/release history, bid form |
| **Match scores** | In-auction sheets; player names → player page |
| **Announcements** | Sales, releases, eliminations |
| **Transfers** | Propose / respond (when window open) |
| **Leaderboard / Points** | Often redirect or link to `/leaderboard/[id]` |

### Deadlines presentation

| Mode | UI |
|------|-----|
| `global` | Three-column deadlines (`AuctionDeadlines.tsx`) |
| `nation_rolling` | Nation schedule control (`NationRollingDeadlinesButton.tsx` + `lib/nation-deadlines-data.ts`) |

### Acting-as

Commissioners / dual seats: `ActingAsPicker` — act as a manager or **view only (no bidding)**. Cookie-based actor resolution in `lib/auction-dashboard.ts`.

### Relegated banner

View-only messaging when `is_relegated` — do not hide the whole auction.

---

## Leaderboard presentation (`/leaderboard/[auctionId]`)

| Tab / element | Behaviour |
|---------------|-----------|
| **Standings** | Season rank + points from `auction_leaderboard` sums |

Per-GW squad tabs (Best XI / bench) are parked for now — World Cup gameweeks must not appear on Premier League or later auctions. Reintroduce GW tabs only when that competition has its own locked gameweeks to show.
| Formation | From published Best XI overlay JSON when present |
| Match Pos | Scoring / XI role columns for transparency |
| Relegated | Still listed, flagged |

Do not redesign columns every competition; add data, not a new layout.

---

## Match scores

- **Public (canonical):** `/match-scores` (grouped by GW) — anyone; player names are plain text
- **In-auction:** `/auctions/[auctionId]/match-scores` — members only (incl. archived if still a member); same sheets; player names link to `/auctions/[auctionId]/players/[playerId]`
- Legacy redirects: `/scores/[slug]` → public match-scores
- Data: `data/match-scores/*_FinalPoints.csv` + `lib/match-scores/sheets.ts`

When a competition ends, sheet registry may be cleared and CSVs archived — keep the **routes** for the next season’s sheets.

---

## WC-era UI decisions to keep as standard

These were validated in production and should be the default for future seasons unless product explicitly revisits them:

1. Split **Active / Archives / History** instead of one mixed “Your auctions” list  
2. Archives deep-link to **leaderboard**, not bidding room  
3. History shows **ordinal finish + year** with podium emojis only for 1–3  
4. Match scores as a **nav link**, not a dashboard card  
5. Nation-rolling deadlines as a **dedicated control**, not fake global columns  
6. Leaderboard Best XI / bench split after publish  

---

## What not to improvise mid-auction

- New top-level nav items without updating `ParticipantNav` + middleware auth matcher  
- One-off pages under `/scores` that bypass `sheets.ts`  
- Hardcoded participant names in UI components  
- CSS/theme rewrites during a live GW  

Document intentional UI changes here when they become the new standard.
