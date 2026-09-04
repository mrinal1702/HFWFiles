# Ops: Participant relegations (view-only cut)

**Canonical for agents.**  
Related: [OPS_BIDDING_AND_DEADLINES.md](./OPS_BIDDING_AND_DEADLINES.md), [OPS_UI_SURFACES.md](./OPS_UI_SURFACES.md).

---

## What it is

A manager is **cut from further bidding** (e.g. after a knockout stage) but can still **view** the auction: leaderboard, announcements, transfer history, competitors, etc.

This is **not** the same as nation eliminations (real football teams). See [OPS_ELIMINATIONS.md](./OPS_ELIMINATIONS.md).

---

## Schema

Apply once per environment:

- `scripts/sql/participant-relegation-schema.sql` — `auction_users.is_relegated`, `relegated_at`; audit table `auction_participant_relegations`
- `scripts/sql/participant-relegation-rpc.sql` — blocks on bids / releases

Fallback file (if column missing): `data/relegated-participants.json`  
App helper: `lib/relegated-participants.ts`, guard: `lib/relegated-guard.ts`

---

## What happens when someone is relegated

Commissioner runs (after editing the ID map for that season):

```bash
cd auction-app
node scripts/apply-participant-relegations.mjs --dry-run
node scripts/apply-participant-relegations.mjs
```

**Effects (standard):**

1. All owned players returned to pool (`auction_lots` → `uninitiated`)
2. `auction_teams` cleared for that manager
3. Budgets zeroed / non-spendable as implemented in the script
4. `is_relegated = true` (+ audit row when table exists)

**They can still:**

- Open the auction, read leaderboard / GW squads / announcements
- Browse competitors and history
- See that they are relegated (banner in auction layout)

**They cannot:**

- Place bids (DB trigger + app asserts)
- Release players
- Propose / accept transfers (app + RPC guards)

Message constant: `RELEGATION_ACTION_MESSAGE` in `lib/relegated-participants.ts`.

---

## Product UX

- Auction layout shows a clear **relegated / view-only** state.
- Standings keep relegated managers listed (`isRelegated` on `StandingEntry`).
- Prefer **Acting as → View only** patterns for commissioners observing; relegation is a permanent seat state for that auction.

---

## Standardization rules

- Choose cut rules **before** the stage (e.g. bottom N after GW7). Apply via the script — do not manually delete `auction_users` rows.
- Do not remove relegated users from `auction_leaderboard` history.
- Season-specific ID lists belong in the apply script config (or a future DB table) — update the list carefully; dry-run first.
- After the tournament, archive the ID list with competition records; start fresh for the next season.
