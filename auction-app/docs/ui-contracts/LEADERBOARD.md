# Leaderboard UI contract

**Status:** Implemented 24 Aug 2026 (one-GW dropdown; default = latest GW with scores uploaded).  
**Live reference:** https://hfwauction.vercel.app/leaderboard/9?tab=my-points  
**Product owner rule:** Do not change layout, copy, columns, chrome, or interaction unless the user **explicitly** asks. Adding a gameweek is data, not a UI redesign.

This is the canonical spec for `/leaderboard/[auctionId]`. Prefer it over improvising from World Cup archives, screenshots, or “improvements.”

Related: [OPS_UI_SURFACES.md](../OPS_UI_SURFACES.md), [OPS_SCORING_AND_LEADERBOARD.md](../OPS_SCORING_AND_LEADERBOARD.md), parked Best XI UI in `GameweekSquadView.tsx`.

---

## How agents must treat this file

1. Read this contract **before** editing any leaderboard file listed below.
2. If a requested change would alter layout, labels, columns, default GW, or tab structure, **stop and confirm** unless the user already specified that change.
3. After an **explicit** UI change ships, update **this file in the same change** so the contract stays the source of truth. Do not leave the code as the only record.
4. New gameweeks must not add columns, tabs, or width. Only the GW dropdown option list grows.

### Files in scope

- `app/leaderboard/[auctionId]/layout.tsx`
- `app/leaderboard/[auctionId]/page.tsx`
- `app/leaderboard/[auctionId]/_components/*`
- `app/auctions/[auctionId]/competitors/**` (owned-points / competitor GW view)
- `lib/leaderboard-data.ts` (only as needed to feed this UI)

---

## Frozen chrome (do not restyle)

Keep the existing auction-app light theme unless explicitly told otherwise:

- Page shell: `max-w-5xl`, header “← Back to auction”, `{auction name} · Leaderboard`, `RefreshButton`
- Top tabs (exactly three, pill switcher, URL `?tab=`): **Standings** | **My Points** | **Competitors**
- Palette: white cards, `border-slate-200`, sky header rows / active tab, slate body text, `font-mono` for numbers
- Manager identity: `ManagerChip` (team name preferred) + manager name underneath when a team name exists
- Mobile: card list; desktop: table — same pattern as today
- **No extra top-level tabs** as gameweeks are added

---

## Snapshot: layout at agreement time (pre-redesign)

What production showed on My Points (auction 9):

1. Three tabs; My Points active.
2. Summary card: team crest, team name, manager name, **Total points so far** (large number), disclaimer that Best XI is not applied.
3. Squad table of **current / aggregated ownership**, not a single locked GW:
   - Columns observed: Player, Club, Pos, a named GW column (e.g. Premier League GW1), Total.
   - With only one scored GW, GW and Total duplicated the same numbers.
4. Repo at that time had started hiding per-GW columns in `OwnedPointsView`, but the product problem remained: one table mixing players across weeks.

**Why that is wrong:** squads change GW to GW. A sold GW1 player must not sit in the GW2 view. A bought GW2 player must not appear in the GW1 view.

Standings tab (unchanged by this redesign unless later specified): season rank + filterable GW totals from `auction_leaderboard`.

---

## Target: My Points and Competitors (agreed)

### Interaction

| Rule | Behaviour |
|------|-----------|
| One GW at a time | Never show multiple GW score columns on one table |
| GW picker | **One dropdown** of this auction’s gameweeks. Not tabs, not chips that multiply with each GW |
| Default | **Latest gameweek that has scores uploaded.** When GW2 scores are uploaded, default becomes GW2 without a code change per week |
| Revisit | User can pick an earlier GW in the same dropdown |
| URL | Persist selection (`tab` + `gw`) so refresh/share keeps the same week. Omitting `gw` uses the default |
| Competitors | Same dropdown + same table. Opening a competitor shows **their** squad for the **default current GW**; the dropdown still switches that competitor’s past weeks |

### My Points header

- Keep team / manager identity as today.
- **Small season-total box** at the top (Best XI season sum from standings / `auction_leaderboard`). Full ranking stays on **Standings**.
- Primary number on this tab is **the selected GW**, not a career squad sum.

### Table for the selected GW only

Columns, in this order:

| Column | Meaning |
|--------|---------|
| Player | Name |
| Club | Club |
| Listed Pos | Database / pool position (existing Pos) |
| Match Pos | FotMob / FinalPoints playing role for **that GW** (`matchPosition`). `—` if they did not play or scores not in yet |
| Score | Points for **that GW only**. Never labelled “GW1 score” / “Premier League GWn” — the dropdown is the GW |

No Total column on this table. Trailing column label is **Score**.

Ownership for a row = locked `gameweek_squads` for that GW (live `auction_teams` only as fallback before lock, existing loader behaviour).

### After Best XI is published for that GW

Reuse the World Cup / `GameweekSquadView` precedent — do not invent a new split:

- **Starting XI** block with count and **formation** (e.g. `3-5-2`)
- **Bench / substitutes** block with their scores (dimmed vs XI)
- Selected-GW header uses **Best XI score** for that week (standings source: `auction_leaderboard.total_score` for that GW)
- Before Best XI publish, flat squad list; optional “squad points so far” is the sum of uploaded player scores for **that GW’s locked squad**, not a season total

Best XI runs when that gameweek’s matches are complete and ops publish — the UI must already support XI + subs + formation so later GWs do not need a redesign.

---

## Scoring semantics (do not mix)

| Surface | Number |
|---------|--------|
| Standings | Sum of published `auction_leaderboard.total_score` (Best XI after publish) |
| My Points / Competitors season box | Same season total as standings for that manager |
| My Points / Competitors table Score | That player’s points in the **selected GW** |
| Match Pos | Playing role from match stats for that GW; Best XI may use listed **or** match role |

Do not show “sum of all currently owned players across all GWs” as the main table.

---

## Scale rule

As GWs are added: dropdown options increase; table width and tab count stay the same.

---

## Explicitly out of scope unless the user asks

- Changing Standings columns, GW checkbox filter, or relegated styling
- Extra leaderboard tabs
- Theme / spacing / typography rewrites
- Showing all GWs in one wide table
- Per-competition one-off leaderboard layouts
