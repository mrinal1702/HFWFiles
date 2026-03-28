# Testing operations (auctions & bidding)

Quick reference for **you** (or an agent) when you need to reset data, refresh managers, or add **another auction** on top of the same player pool and **shared game weeks**.

Prerequisites:

- `auction-app/.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and usually `AUCTION_LAB_AUCTION_ID` after a reset.
- SQL already applied in Supabase (order matters the first time):  
  `scripts/sql/auction-bidding.sql` → `reset-testing-environment.sql` → `seed-auction-lots-all-players.sql` → **`testing-auction-helpers.sql`** (for stack / replace helpers).

Run SQL files in **Supabase → SQL Editor** (full file, Run). `npm` scripts call RPCs and expect those functions to exist.

---

## 1) Full test reset (single canonical auction + shared game week)

**What it does**

- Truncates/wipes: `auction_lots`, `auction_bids`, `auction_teams`, `auction_leaderboard`, `auction_score_breakdown`, scores table (`player_scores` / `Player_Scores`), all `Game_Weeks`.
- Inserts one game week: **`UEFA CL RO16 Leg 1`**, `id = 1`, `Is_Active = true`.
- Creates **one new** `Auctions` row (`bidding_test_auction`, new `id` = max+1), hard deadline as defined in SQL.
- **Keeps** `public.players` unchanged.
- **Keeps** `auction_users` **row count** but **reassigns everyone** to the new auction and sets **`budget_remaining` / `active_budget` = 350**.

**How**

```bash
cd auction-app
npm run reset:testing
```

Or in SQL:

```sql
select public.reset_testing_environment();
```

Then **restart** `npm run dev` so Next.js reloads `.env.local` (the script updates `AUCTION_LAB_AUCTION_ID`).

---

## 2) New player list (global pool) + re-seed lots

**Players are global** (`public.players`). Auctions do **not** own a separate copy of player rows; **`auction_lots`** ties `(auction_id, player_id)` to bidding state.

1. **Update the pool** (your choice):
   - Re-import CSV into Supabase / sync from `Player_List/master_player_list.csv` (see repo `docs/AUCTION_PREPARATION_PROCEDURE.md`), **or**
   - Edit `players` in the Supabase Table Editor.
2. **Re-seed lots** for the auction you care about (usually `AUCTION_LAB_AUCTION_ID`):

```bash
npm run seed:auction-lots
```

Idempotent: existing `(auction_id, player_id)` pairs are skipped (`ON CONFLICT DO NOTHING`).

3. If you also want **fresh managers and no bid history** for that auction only, see **§4** (`replace:auction-users`).

---

## 3) Stack another auction (multi-auction test / deployment pattern)

**Use when:** same **`players`** table and same **game week** rows for the project, but a **separate competition** with its **own `auction_id`**, **own `auction_users`**, and **own `auction_lots`** rows.

**RPC:** `public.create_stacked_test_auction(p_auction_name, p_hard_deadline, p_user_count, p_start_budget, p_is_active)`

**CLI**

```bash
cd auction-app
npm run stack:auction -- "my_second_league" "2026-05-01T18:00:00+01:00" 8 350
```

Arguments: name, deadline (ISO string Postgres accepts), optional user count (default 8), optional starting budget (default 350).

**SQL (equivalent)**

```sql
select public.create_stacked_test_auction(
  'my_second_league',
  (timestamp '2026-05-01 18:00:00' at time zone 'Europe/Dublin'),
  8,
  350,
  true
);
```

Response includes **`auction_id`**. Point **`AUCTION_LAB_AUCTION_ID`** (or your UI’s auction scope) at that id.

**Does not modify** other auctions or their users.

---

## 4) Replace managers on one auction + wipe that auction’s state + re-seed lots

**Use when:** you want a **new set of test users** for the **same `auction_id`**, or you changed **`players`** and want a clean slate **for that auction only**.

**Destructive for that `auction_id` only:** deletes bids, lots, teams, leaderboard/breakdown rows for that auction, **deletes all `auction_users` for that auction**, inserts `p_user_count` new managers, then **`seed_auction_lots_for_auction`**.

**CLI**

```bash
cd auction-app
npm run replace:auction-users -- 2 10 350
```

Args: `auction_id` (optional if `AUCTION_LAB_AUCTION_ID` is set), `user_count`, `budget`.

**SQL**

```sql
select public.replace_auction_users_fresh_state(2, 10, 350);
```

---

## 5) Combined scenario cheat sheet

| Goal | Steps |
|------|--------|
| Nuclear reset + one test auction + 8 users @ 350 | `npm run reset:testing` → restart dev |
| Same auction, new global player list | Update `players` → `npm run seed:auction-lots` |
| Same auction, new managers + no bid history | `npm run replace:auction-users -- <auction_id> <n> 350` |
| Second league, same players, new auction | `npm run stack:auction -- "name" "<deadline_ISO>" 8 350` → use returned `auction_id` |

---

## Supabase guardrails

Some projects enforce **no `UPDATE`/`DELETE` without a `WHERE`** (SQLSTATE `21000`). The reset/helper SQL in this repo is written to satisfy that. If you add custom SQL, keep predicates explicit.

---

## Scripts index

| Script | Purpose |
|--------|---------|
| `npm run reset:testing` | `reset_testing_environment` |
| `npm run seed:auction-lots` | `seed_auction_lots_for_auction` (uses `AUCTION_LAB_AUCTION_ID`) |
| `npm run stack:auction` | `create_stacked_test_auction` |
| `npm run replace:auction-users` | `replace_auction_users_fresh_state` |
