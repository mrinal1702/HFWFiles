# Ops: Player / nation eliminations (half-price refunds)

**Canonical for agents.**  
WC-specific narrative may exist under `archive/world-cup-2026/docs/` — reuse this procedure for any knockout competition.

Related: [OPS_RELEASES.md](./OPS_RELEASES.md), [ANNOUNCEMENTS.md](./ANNOUNCEMENTS.md).

---

## What it is

When a **real-world team** is knocked out of the competition, every owned player from that `players.team_name` is removed from managers’ squads and managers receive a **half-price refund** (same formula as paid release).

This is an **automatic commissioner action**, not a voluntary release. It does **not** consume `paid_release_used`.

---

## Setup (once)

```sql
-- scripts/sql/auction-elimination-refunds-setup.sql
```

Creates audit table `auction_elimination_refunds`.

---

## Apply (standard)

```bash
cd auction-app
# --auction-ids is required; all ids must belong to the same (non-archived) competition
node scripts/apply-elimination-refunds.mjs --auction-ids 10,11,12,13 --dry-run "Club Brugge" LASK
node scripts/apply-elimination-refunds.mjs --auction-ids 10,11,12,13 "Club Brugge" LASK
```

- Players are taken from **that competition's pool** (`competition_players`), never the global `players` table. A player's club can differ between competitions (e.g. Konsa: Aston Villa in EPL, Arsenal in UCL), and most UCL players are not in `players` at all.
- **Team names must match the competition pool's `team_name` exactly** (e.g. `Paris Saint-Germain`, `Bayern Munich`). An unknown name aborts the run and suggests close matches.
- Mixed competitions, auctions with no competition, and archived competitions are refused (`--allow-archived` only for approved amendments).
- Always dry-run first and check the owner/refund list.

SQL twin: `scripts/sql/apply-elimination-refunds.sql` is the old World Cup version (reads global `players.team_name`) — **do not use it for UCL**; use the script.

---

## Refund formula

```text
floor((purchase_price + 1) / 2)
```

Examples: £40 → £20; £41 → £21.

Credits manager budgets (as implemented in the script).

---

## Lot / squad effects

| Situation | Effect |
|-----------|--------|
| Owned (`auction_teams`) | Removed from squad; refund logged; lot → **`unsold`** (not immediately re-biddable as a fresh open lot — by design for eliminations) |
| Open `bidding` on eliminated nation | High bid released from `active_budget`; lot closed |
| `gameweek_squads` | **Not** rewritten — past GW snapshots stay intact |

Idempotent via audit table / absence from `auction_teams`.

---

## Announcements

Elimination refunds appear on the auction **Announcements** page (Elimination Releases feed) sourced from `auction_elimination_refunds`. See [ANNOUNCEMENTS.md](./ANNOUNCEMENTS.md).

---

## Timing (product convention)

- Run **after** the round’s results are confirmed and **before** or **as** the next bidding window opens.
- Prefer dry-run → verify counts → apply.
- Coordinate with [OPS_BIDDING_AND_DEADLINES.md](./OPS_BIDDING_AND_DEADLINES.md) reopen (unsold → uninitiated may reopen pool players who were never owned; eliminated owned lots stay `unsold` unless you deliberately change that policy).

---

## Standardization rules

- One script for all competitions; pass `--auction-ids` and nation names.
- Never hand-edit dozens of `auction_teams` rows in the SQL editor without the audit table.
- Do not confuse with relegations (managers cut) or voluntary releases.
- Keep nation name spelling identical to the player pool.
