# How Football Works — Gameweek Flow & Gameplay Logic

Last updated: June 2026

This document describes the full game cycle for the HFW online auction. It covers how gameweeks work, what happens between them, and which operations are done via the front end vs. the back end (SQL / Cursor agent).

---

## Overview

The HFW auction runs as a **single continuous auction** across the whole tournament (e.g. World Cup 2026). There is one `"Auctions"` row in the database throughout. Gameweek boundaries are defined by the `hard_deadline_at` field on that row, which is updated manually between rounds.

Participants build a squad through bidding. At each gameweek's hard deadline, the squad is **formally snapshotted** — that frozen snapshot is what scoring runs against. After the deadline, bidding re-opens and participants are already building their next gameweek's squad.

---

## Gameweek cycle (repeats each round)

### Phase 1 — Bidding window
- Bidding is open. Participants place bids, win players, and build their squad.
- Releases (paid/free) are available in this window — see `PLAYER_RELEASE_SYSTEM.md`.
- The hard deadline for this gameweek is set in `"Auctions".hard_deadline_at`.

### Phase 2 — Hard deadline hit
- Bidding closes automatically (the app enforces `hard_deadline_at`).
- The squad each participant has in `auction_teams` at this exact moment becomes their **Gameweek N Team**.
- **The squad snapshot must be formally recorded** at this point (see Snapshot section below). This is a back-end operation — there is no front-end trigger for it.
- The paid release quota is reset for all participants (back end, SQL).

### Phase 3 — Budget boost (GW1 only, one time)
- After the GW1 hard deadline and before GW2 bidding opens, **£100m is added to every participant's `budget_remaining` and `active_budget`**.
- This happens **once only**, after GW1. It does not repeat in subsequent gameweeks.
- Back-end operation — SQL run by commissioner.

```sql
-- Run once after GW1 hard deadline
UPDATE auction_users
SET budget_remaining = budget_remaining + 100,
    active_budget    = active_budget    + 100
WHERE auction_id = <auction_id>;
```

### Phase 4 — GW2 bidding window opens
- Commissioner updates `hard_deadline_at` on the `"Auctions"` row to the GW2 deadline.
- Bidding re-opens. Any players won or released from this point count toward the **GW2 team**, not GW1.
- The GW2 bidding window can overlap with GW1 matches — participants can be buying GW2 players while GW1 is being played.
- Back-end operation — SQL run by commissioner.

```sql
-- Set the next GW hard deadline (replace timestamp as appropriate)
UPDATE "Auctions"
SET hard_deadline_at = '2026-06-18T17:00:00+00:00'
WHERE id = <auction_id>;
```

### Phase 5 — Matches in play, scores uploaded
- GW1 matches are in progress.
- Commissioner uploads player scores to the app as matches conclude.
- Participants can see live/ongoing scores in the app against their players.
- **No formation/best XI logic is run yet** — scores are raw at this stage.

### Phase 6 — All GW matches complete → scoring triggered
- Once every match in the gameweek is finished, the commissioner runs the formation/best XI logic.
- The logic runs **against the GW snapshot** (not the live `auction_teams` — participants may have already changed their squad for GW2 by this point).
- Each participant receives a GW score based on their snapshotted team.
- Back-end operation — Python pipeline run by commissioner.

---

## Gameweek 1 specific timeline (World Cup 2026)

| Event | Date / Time | Who |
|-------|-------------|-----|
| GW1 bidding opens | Before June 11 | Commissioner sets `hard_deadline_at` |
| **GW1 hard deadline** | Before first WC kickoff, June 11 | App enforces automatically |
| GW1 squad snapshot recorded | Right after GW1 deadline | Commissioner — back end |
| GW1 paid releases reset | Right after GW1 deadline | Commissioner — SQL |
| £100m budget boost applied | Right after GW1 deadline | Commissioner — SQL (one time only) |
| GW2 bidding opens | Commissioner sets new `hard_deadline_at` | Commissioner — SQL |
| GW1 last match | ~June 18, ~03:00 Ireland time (Uzbekistan vs Colombia) | — |
| **GW2 hard deadline** | ~1 hour before Czechia vs South Africa, June 18 | App enforces automatically |
| GW1 formation logic run | After Uzbekistan vs Colombia finishes | Commissioner — Python pipeline |
| GW1 scores finalised in app | After formation logic | Commissioner — script |

---

## The squad snapshot

### Why it is needed
The live `auction_teams` table reflects the **current** squad, which changes continuously as participants buy and release players. By the time GW1 scoring runs (after June 18), participants will have already modified their squad for GW2. We cannot run scoring against `auction_teams` directly — we need a point-in-time record.

### What it contains
For each gameweek, for each participant: the list of players they owned at the hard deadline, along with their purchase prices.

### Where it lives
**To be designed** — a formal `gameweek_squads` table (or equivalent) will be added to the database. This is a planned next step. The UI for viewing GW snapshots is also to be designed.

### How it is triggered
Back-end operation only. The commissioner runs a script or SQL after each hard deadline to copy the current `auction_teams` state into the snapshot table, tagged with the gameweek identifier.

There is no front-end button for this. It is a deliberate back-end gate — scoring is never triggered automatically.

---

## What carries forward between gameweeks

| Item | Carries forward? | Notes |
|------|-----------------|-------|
| Squad (`auction_teams`) | Yes | Live squad evolves continuously |
| `budget_remaining` | Yes | Reduced by purchases, increased by releases/refunds |
| `active_budget` | Yes | Tracks spendable budget accounting for open bids |
| Paid release quota | No — **resets** | Commissioner resets `paid_release_used = false` after each GW deadline |
| GW squad snapshot | N/A | Point-in-time, never changes once recorded |
| £100m budget boost | One-time after GW1 | Never repeated |

---

## Commissioner operations checklist (between GWs)

Run these in order after a hard deadline, before opening the next GW:

1. **Record the squad snapshot** for the gameweek that just closed (script TBD)
2. **Reset paid release quotas:**
   ```sql
   UPDATE auction_users SET paid_release_used = false WHERE auction_id = <auction_id>;
   ```
3. **Apply £100m budget boost** (GW1 → GW2 only, never again):
   ```sql
   UPDATE auction_users
   SET budget_remaining = budget_remaining + 100,
       active_budget    = active_budget    + 100
   WHERE auction_id = <auction_id>;
   ```
4. **Set the new hard deadline** for the next GW:
   ```sql
   UPDATE "Auctions"
   SET hard_deadline_at = '<new_timestamp>'
   WHERE id = <auction_id>;
   ```
5. *(Bidding re-opens automatically once `hard_deadline_at` is in the future and `is_active` is true)*

---

## What is back-end only (no front-end UI)

Everything listed here is done by the commissioner via SQL in Supabase SQL Editor or via a Cursor agent. None of these have or need a front-end UI:

- Recording the GW squad snapshot
- Resetting paid release quotas
- Applying the budget boost
- Updating the hard deadline for a new GW
- Running the formation/best XI scoring pipeline (Python)
- Uploading scores to the app

---

## Planned features (not yet built)

- `gameweek_squads` table schema and snapshot script
- UI for participants to view their past GW squad snapshots
- GW leaderboard (cumulative and per-GW scores)
- Transfers between participants (separate doc to follow)
