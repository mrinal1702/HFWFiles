# Ops: Bidding, deadlines & gameweek windows

**Canonical for agents.** Prefer this over inventing deadline SQL mid-tournament.  
Related: [OPS_RELEASES.md](./OPS_RELEASES.md), [OPS_GAMEWEEK_LOCK.md](./OPS_GAMEWEEK_LOCK.md), [OPS_INDEX.md](./OPS_INDEX.md).

---

## Goal

Open a bidding window, enforce rules in the database (`place_bid` RPC), and close/settle lots when deadlines hit — the same way every competition.

---

## Core tables

| Table | Role |
|-------|------|
| `"Auctions"` | One row per league; deadlines + mode |
| `auction_users` | Managers in that auction (budget, roster seat) |
| `auction_lots` | Per-player lot status in that auction |
| `auction_bids` | Append-only bid history |
| `auction_teams` | Owned (sold) squad — **live** roster |
| `auction_nation_deadlines` | Per-nation raise/hard times (`nation_rolling` only) |
| `players` | Global pool (names, positions, `team_name`) |

### Lot statuses

`uninitiated` → `bidding` → `sold` | `unsold`

---

## Deadline modes

Column: `"Auctions".bidding_deadline_mode`

| Mode | When to use | Behaviour |
|------|-------------|-----------|
| **`global`** (default) | Group stages / single shared deadline | Auction-level `initiation_deadline_at`, `raise_deadline_at`, `hard_deadline_at` |
| **`nation_rolling`** | Knockouts with staggered kickoffs | Per-nation rows in `auction_nation_deadlines`; auction `rolling_game_week_id`; auction `hard_deadline_at` = end of whole window |

Schema / RPC (must be applied in Supabase once per environment):

- `scripts/sql/nation-rolling-bidding-schema.sql`
- `scripts/sql/nation-rolling-bidding-rpc.sql` ← **canonical `place_bid`** when nation rolling is used
- Older copies: `auction-bidding.sql`, `auction-deadline-rules.sql` (do not redeploy over rolling RPC blindly)

---

## Global mode — three phases

| Column on `"Auctions"` | After it passes |
|------------------------|-----------------|
| `initiation_deadline_at` | Cannot open new lots (`uninitiated`); can still raise lots already `bidding` |
| `raise_deadline_at` | Bid increment is always **+5** (no “any integer under 50” rule) |
| `hard_deadline_at` | No bids; run finalize to settle remaining lots |

Typical spacing: ~1 hour between initiation → raise → hard (product convention; not hard-coded).

Rolling lot timer (global): **24 hours** from last bid, **capped** by `hard_deadline_at`.

---

## Nation-rolling mode

Used for World Cup R16 onward; reusable for any staggered knockout.

**Per nation** (`auction_nation_deadlines`):

- `kickoff_at`
- `hard_deadline_at` — usually kickoff − **90 minutes**
- `raise_deadline_at` — usually hard − **60 minutes**
- `locked_at` — set when that nation’s deadline is finalized

**Auction row:**

- `bidding_deadline_mode = 'nation_rolling'`
- `rolling_game_week_id` = the GW being played
- `hard_deadline_at` = hard deadline of the **last** fixture in the window
- `initiation_deadline_at` / `raise_deadline_at` = null (not used)

**Bid rules extras:**

- Player’s `players.team_name` must appear in `auction_nation_deadlines` for this auction, or RPC returns `nation_not_in_round`
- No global initiation gate
- Rolling lot timer: **12 hours**, capped by that nation’s hard deadline
- After nation hard passes, open lots for that nation are finalized; sold players can be written into `gameweek_squads` incrementally

**Open a rolling round (standard tool):**

```bash
# Edit ROUND config inside the script (auction IDs, nations, kickoffs), then:
node scripts/open-nation-rolling-round.mjs
```

Also resets `paid_release_used` for those auctions and re-opens `unsold` lots to `uninitiated` for the new window.

---

## Bid rules (always — enforced in RPC)

| Rule | Detail |
|------|--------|
| Minimum bid | **5** (integer £) |
| Under 50 | Any integer strictly above current high (before raise deadline) |
| At/above 50 or after raise deadline | Must be **+5** (or more in +5 steps as implemented) |
| Self-raise | Allowed |
| Retract | Not allowed |
| Budget | Must fit in `active_budget` (remaining after outstanding high bids) |
| Roster | Max **18** players counting sold + current high bids |
| GK / outfield | Max **1** GK, **17** outfield (same counting) |

TS wrappers: `lib/bidding.ts`  
UI gate messages: `lib/auction-bid-gates.ts`, `lib/bid-ui-messages.ts`

---

## Budgets

| Column | Meaning |
|--------|---------|
| `budget_remaining` | Cash after completed purchases / refunds |
| `active_budget` | Spendable now = remaining minus outstanding high-bid commitments |

Winning a lot moves money from active commitment into owned price on `auction_teams`.

---

## Finalize RPCs (do not skip)

| RPC | Purpose |
|-----|---------|
| `finalize_expired_lots` | Settle lots whose `expires_at` has passed |
| `finalize_auction_hard_deadline` | Global hard close |
| `finalize_due_nation_deadlines` | Nation-rolling: close nations past hard |

The app may call these when loading auction dashboards (`lib/auction-dashboard.ts`). Commissioners can also invoke via SQL/tools if stuck.

---

## Opening a new gameweek (checklist)

1. Confirm previous GW scores / Best XI published (or explicitly deferred).
2. Lock previous GW squads if not already locked — [OPS_GAMEWEEK_LOCK.md](./OPS_GAMEWEEK_LOCK.md).
3. Apply eliminations / relegations if this stage requires them.
4. Set deadlines (global columns **or** nation rows + `open-nation-rolling-round.mjs`).
5. Reset `paid_release_used` (script often does this).
6. Ensure `is_active = true` on the auction if bidding should be open.
7. Smoke-test: one test bid or verify lots show as `uninitiated`/`bidding` as expected.

---

## What not to improvise

- Do not change roster caps or min bid in the UI only — change the RPC.
- Do not hardcode auction IDs inside `place_bid`.
- Do not use live `auction_teams` as the scored squad after the deadline — use `gameweek_squads`.
- Do not invent a fourth deadline column; extend `nation_rolling` or `global` deliberately.
