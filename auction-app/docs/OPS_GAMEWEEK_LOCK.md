# Ops: Gameweek squad lock

**Canonical for agents.**  
Related: [OPS_BIDDING_AND_DEADLINES.md](./OPS_BIDDING_AND_DEADLINES.md), [OPS_SCORING_AND_LEADERBOARD.md](./OPS_SCORING_AND_LEADERBOARD.md).

> Note: Older `GAMEWEEK_FLOW.md` may still say snapshots were “to be designed.” **That is obsolete.** Use this document.

---

## Why lock

After a deadline, managers keep changing live squads (`auction_teams`) for the **next** window. Scoring and Best XI must use a **frozen snapshot** for the gameweek that just closed: `gameweek_squads`.

---

## Table: `gameweek_squads`

Defined in `scripts/sql/gameweek-squads.sql` (+ `xi_role` in `gameweek-squads-xi-role.sql`).

| Column | Meaning |
|--------|---------|
| `auction_id`, `game_week_id`, `auction_user_id`, `player_id` | Unique squad membership |
| `purchase_price` | Copied from ownership |
| `is_best_xi` | Set later by Best XI publish |
| `xi_role` | Formation slot (GK/D/M/F) after publish |
| `locked_at` | When the row was snapshotted |

FK: auction must exist. Unique on the four IDs.

---

## Global / batch lock (standard)

```bash
cd auction-app
node scripts/lock-gameweek-squads.mjs --gw-id N --auction-ids 5,6,7 [--gw-name "…"] [--dry-run]
```

Behaviour:

1. Ensures `Game_Weeks` row exists (optional name)
2. Copies current `auction_teams` → `gameweek_squads` for those auctions / GW (duplicates ignored)
3. Sets that GW’s `Is_Active = true` and **all other** `Game_Weeks.Is_Active = false` (global flip)

Run **once per GW per auction set** after the hard deadline (or after the last nation deadline for that GW).

**Multi-competition caution:** `Is_Active` is global, not per competition. Re-locking a UCL GW (e.g. id 300) will deactivate an EPL active GW (e.g. id 3) and vice versa. Before locking:

1. Query whether `gameweek_squads` already has rows for each auction / GW.
2. If already locked and counts look right, **skip** the lock script — proceed to scoring / Best XI.
3. If you must lock while another competition is mid-season, plan how you will restore the correct `Is_Active` afterward.

---

## Nation-rolling incremental lock

When a nation’s hard deadline finalizes, SQL may insert that nation’s sold players into `gameweek_squads` for `"Auctions".rolling_game_week_id` (`_finalize_nation_deadline_for_auction` in nation-rolling RPC).

Commissioners should still verify full coverage with the lock script or SQL counts before scoring.

---

## Checklist before scoring a GW

1. All relevant lots for that GW are settled (no stuck `bidding` lots that should be sold).
2. `gameweek_squads` row counts look right per manager (≈ squad size).
3. `Game_Weeks` id matches the GW you will upsert scores into.
4. Only then: upsert `Player_Scores` and run Best XI — [OPS_SCORING_AND_LEADERBOARD.md](./OPS_SCORING_AND_LEADERBOARD.md).

---

## What not to improvise

- Do not score from `auction_teams` “because it’s easier.”
- Do not delete `gameweek_squads` for a published GW without a rollback plan for `auction_leaderboard`.
- Do not invent a second snapshot table.
