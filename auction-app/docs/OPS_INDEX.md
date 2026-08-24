# HFW Auction — Operations Index (agent entry)

**Last updated:** July 2026  
**HFW** = How Football Works.

This folder is the **canonical ops handbook** for online auctions. Prefer these docs over improvising SQL or one-off scripts during a live competition.

Tournament-specific archives (e.g. World Cup 2026) live under `archive/world-cup-2026/` and are **historical**, not the live playbook.

---

## Principles (standardization)

1. **Reuse code and RPCs** — bidding, releases, locks, scores, Best XI, relegations, eliminations already have scripts/SQL. Extend them; do not invent parallel paths.
2. **Do not change participant UI mid-season** unless fixing a bug. New competitions should inherit the same surfaces (`/dashboard`, `/archives`, `/auction-history`, `/auctions/[id]/*`, `/match-scores`). New in-auction pages must be added via the **left side menu** (`AuctionSideNav`) — see [OPS_UI_SURFACES.md](./OPS_UI_SURFACES.md).
3. **Schema changes are manual SQL** in Supabase (`auction-app/scripts/sql/*`). There is no migration runner — document every new script in the relevant OPS doc.
4. **Scores and standings** always flow through published tables (`Player_Scores`, `gameweek_squads`, `auction_leaderboard`). Never invent standings in the UI from live `auction_teams` alone.
5. **Competition-specific IDs** (archived auctions, history years) belong in small config modules (`lib/archived-auctions.ts`), not scattered hardcodes.

---

## Two products

| Product | Routes | Scope |
|---------|--------|--------|
| **Online auction** | `/auctions/*`, `/dashboard`, `/leaderboard/*` | Async bidding, releases, transfers, GW scoring |
| **Live auction** | `/live-auction/*` | Verbal Zoom auction recording only — **isolated** |

This index is primarily about the **online** product.

---

## Ops docs (read in this order for a new competition)

| Doc | Topic |
|-----|--------|
| [OPS_BIDDING_AND_DEADLINES.md](./OPS_BIDDING_AND_DEADLINES.md) | GW open, deadline modes, `place_bid`, budgets, roster caps |
| [OPS_RELEASES.md](./OPS_RELEASES.md) | Paid / free releases |
| [OPS_GAMEWEEK_LOCK.md](./OPS_GAMEWEEK_LOCK.md) | Locking squads into `gameweek_squads` |
| [OPS_SCORING_AND_LEADERBOARD.md](./OPS_SCORING_AND_LEADERBOARD.md) | FinalPoints → Supabase → Best XI → standings → Vercel |
| [OPS_RELEGATIONS.md](./OPS_RELEGATIONS.md) | Cutting managers; view-only behaviour |
| [OPS_ELIMINATIONS.md](./OPS_ELIMINATIONS.md) | Real-world team knockouts; half-price refunds |
| [OPS_UI_SURFACES.md](./OPS_UI_SURFACES.md) | Participant UI map; mobile chrome (zoom / side menu / deadlines); what may change vs must stay stable |
| [ui-contracts/LEADERBOARD.md](./ui-contracts/LEADERBOARD.md) | Frozen leaderboard layout (Standings / My Points / Competitors) — do not improvise UI |
| [OPS_OTHER_MODULES.md](./OPS_OTHER_MODULES.md) | Transfers, announcements, acting-as, archives/history, live auction |
| [ENTITY_INTERCONNECT_PLAN.md](./ENTITY_INTERCONNECT_PLAN.md) | Planned manager/player/profile links, avatars, phased delivery |

### Also useful (existing)

| Doc | Topic |
|-----|--------|
| [TRANSFER_ROOM.md](./TRANSFER_ROOM.md) | Peer-to-peer transfers (detail) |
| [ANNOUNCEMENTS.md](./ANNOUNCEMENTS.md) | Feed composition |
| [PLAYER_RELEASE_SYSTEM.md](./PLAYER_RELEASE_SYSTEM.md) | Older release write-up (superseded in part by OPS_RELEASES) |
| [BIDDING_SYSTEM_AND_UI_HANDOFF.md](./BIDDING_SYSTEM_AND_UI_HANDOFF.md) | Legacy technical handoff — prefer OPS_BIDDING for ops |
| [USER_UI_AND_DEPLOYMENT.md](./USER_UI_AND_DEPLOYMENT.md) | Deploy / route notes |
| [TESTING_OPERATIONS.md](./TESTING_OPERATIONS.md) | Lab / reset helpers |
| [LIVE_AUCTION_COMMISSIONER_GUIDE.md](./LIVE_AUCTION_COMMISSIONER_GUIDE.md) | Live module |

### Repo-root scoring / deploy

| Doc | Topic |
|-----|--------|
| `docs/SCORING_OPERATIONS_RUNBOOK.md` | Older GW CSV path (CL-era) |
| `docs/STAT_COLLECTION_AND_WORKFLOW.md` | Stat collection |
| `docs/MAIN_PIPELINE_FUNCTIONS.md` | Python scoring functions |
| `docs/VERCEL_DEPLOYMENT_PLAYBOOK.md` | Vercel root = `auction-app` |
| `docs/AUCTION_PREPARATION_PROCEDURE.md` | Building the player pool |

---

## Stack snapshot

| Layer | Tech |
|-------|------|
| App | Next.js (App Router), TypeScript, Tailwind |
| DB | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Host | Vercel — **Root Directory must be `auction-app`** |
| Live URL | https://hfwauction.vercel.app |

Credentials: `auction-app/.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Never commit secrets.

---

## Typical gameweek loop (online)

1. Open bidding window (`hard_deadline_at` and/or nation deadlines) — [OPS_BIDDING_AND_DEADLINES.md](./OPS_BIDDING_AND_DEADLINES.md)
2. Managers bid / release / transfer
3. Lock squads at deadline — [OPS_GAMEWEEK_LOCK.md](./OPS_GAMEWEEK_LOCK.md)
4. Score matches → upsert → Best XI → publish leaderboard — [OPS_SCORING_AND_LEADERBOARD.md](./OPS_SCORING_AND_LEADERBOARD.md)
5. Optional: eliminations / relegations between stages
6. Reset `paid_release_used`, reopen next window

---

## Agent handoff

For product orientation and “do not break” rules, also read [AGENT_HANDOFF.md](./AGENT_HANDOFF.md). For day-to-day ops, **start here** (`OPS_INDEX.md`).
