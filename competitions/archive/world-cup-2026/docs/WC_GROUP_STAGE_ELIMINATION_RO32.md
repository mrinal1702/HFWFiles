# World Cup — Group stage elimination → RO32 bidding

Last updated: June 2026

Commissioner runbook for the **tight window between the end of the group stage and the start of Round of 32 bidding**. Covers nation eliminations, half-price refunds, and getting managers their budget back quickly so RO32 bidding can open on schedule.

**Related docs:** `GAMEWEEK_FLOW.md`, `PLAYER_RELEASE_SYSTEM.md`, `BIDDING_SYSTEM_AND_UI_HANDOFF.md`

---

## Why this exists

In the World Cup auction, when a **nation is knocked out**, every manager who owns players from that nation receives a refund of **half what they paid**, rounded up for odd prices (same formula as a paid release).

Example: Alphonso Davies bought for **£30m** → **£15m** back when **Canada** is eliminated.

Between the **group stage and RO32**, we often **cannot confirm all eliminated nations until the last group match** finishes — because third-placed teams may still qualify. That leaves only **a few hours** to:

1. Confirm the final list of eliminated nations
2. Remove those players from live squads
3. Credit refunds to budgets
4. Open the RO32 bidding window (deadlines on `"Auctions"`)

This document is the **repeatable SQL procedure** for step 2–3. It is designed to be **idempotent**: run it once with the first batch of confirmed eliminations, then run again with additional nations as they become final — already-processed players are skipped.

---

## Refund rules (match paid release financially)

| Rule | Detail |
|------|--------|
| Refund amount | **`ceil(purchase_price / 2)`** — implemented as **`(purchase_price + 1) / 2`** in integer SQL |
| Examples | £30 → £15, £31 → £16, £41 → £21 |
| Budget columns | Both **`budget_remaining`** and **`active_budget`** are increased by the refund |
| Paid release quota | **Not consumed** — `paid_release_used` is **not** changed (this is separate from the 1-per-GW voluntary paid release) |
| Player pool | Eliminated-nation lots are set to **`unsold`** (not re-biddable) |
| Open bids | If someone is **winning a bid** on an eliminated-nation player but does not own them yet, their **full bid reserve** is released from `active_budget` (half refund applies only to **owned** players in `auction_teams`) |

Players are matched by **`players.team_name`** (e.g. `'Canada'`). Names must match the database **exactly**.

---

## Scope (current deployment)

| Item | Value |
|------|--------|
| Auctions | **5, 6, 7** (HFW WC Fantasy Auctions 1–3 Online) |
| Gameweek context | Written for **GW2 → RO32** transition; live squad is `auction_teams` |
| Snapshots | **`gameweek_squads` is not updated** by this procedure — locked GW snapshots stay as-is (fine while still in GW2; revisit if eliminations must affect a locked GW view) |
| Announcements | Refunds are logged in **`auction_elimination_refunds`** and shown on the auction **Announcements → Elimination Releases** tab (all participants, auction-scoped). |

---

## One-time setup (run once in Supabase SQL Editor)

Creates an audit table so the apply script can be re-run safely.

```sql
create table if not exists public.auction_elimination_refunds (
  id              bigserial primary key,
  auction_id      bigint      not null references public."Auctions"(id) on delete cascade,
  auction_user_id bigint      not null references auction_users(id) on delete cascade,
  player_id       text        not null,
  team_name       text        not null,
  purchase_price  int         not null,
  refund_amount   int         not null,
  created_at      timestamptz not null default now(),
  unique (auction_id, player_id)
);

create index if not exists idx_elimination_refunds_auction
  on public.auction_elimination_refunds (auction_id);
```

Safe to re-run (`IF NOT EXISTS`).

---

## Commissioner procedure

Run in order after the **final group-stage results** confirm which nations are out.

### 1. Confirm nation names in the database

```sql
select distinct team_name
from public.players
order by team_name;
```

Use the exact strings from this list in the scripts below (e.g. `'Canada'`, not `'CAN'`).

If unsure about spelling:

```sql
select distinct team_name
from public.players
where team_name ilike any (array['%canada%', '%scotland%', '%mexico%'])
order by 1;
```

### 2. Preview — who will be affected?

Edit the **`eliminated_teams`** and **`auction_ids`** arrays, then run **read-only**:

```sql
-- ═══ EDIT THESE ═══
with config as (
  select
    array['Canada', 'Haiti']::text[]   as eliminated_teams,   -- nations knocked out
    array[5, 6, 7]::bigint[]           as auction_ids         -- WC auction ids
)
-- ═══════════════════

select
  au.name              as manager,
  c.auction_id,
  p.team_name          as nation,
  p.player_name,
  t.player_id::text    as player_id,
  t.purchase_price,
  (t.purchase_price + 1) / 2 as refund_amount
from public.auction_teams t
join public.players p
  on p.player_id::text = t.player_id::text
join public.auction_users au
  on au.id = t.auction_user_id
cross join config c
where t.auction_id = any (c.auction_ids)
  and p.team_name = any (c.eliminated_teams)
  and not exists (
    select 1
    from public.auction_elimination_refunds r
    where r.auction_id = t.auction_id
      and r.player_id = t.player_id::text
  )
order by c.auction_id, p.team_name, au.name, p.player_name;
```

**Check:** row count and total refunds look reasonable. Zero rows means either no owners, wrong team names, or already processed.

Optional — preview open bids that will be cancelled:

```sql
with config as (
  select
    array['Canada']::text[]   as eliminated_teams,
    array[5, 6, 7]::bigint[]  as auction_ids
)
select
  au.name           as high_bidder,
  al.auction_id,
  p.team_name,
  p.player_name,
  al.player_id,
  b.amount          as bid_reserve_to_release
from public.auction_lots al
join public.players p on p.player_id::text = al.player_id
join public.auction_bids b on b.id = al.current_high_bid_id
join public.auction_users au on au.id = al.current_high_bidder_id
cross join config c
where al.auction_id = any (c.auction_ids)
  and al.status = 'bidding'
  and p.team_name = any (c.eliminated_teams);
```

### 3. Apply — remove players and credit refunds

Same arrays as preview. Run as **one transaction**:

```sql
begin;

with config as (
  select
    array['Canada', 'Haiti']::text[]   as eliminated_teams,   -- EDIT
    array[5, 6, 7]::bigint[]           as auction_ids         -- EDIT
),

targets as (
  select
    t.auction_id,
    t.auction_user_id,
    t.player_id::text as player_id,
    t.purchase_price,
    p.team_name,
    (t.purchase_price + 1) / 2 as refund_amount
  from public.auction_teams t
  join public.players p
    on p.player_id::text = t.player_id::text
  cross join config c
  where t.auction_id = any (c.auction_ids)
    and p.team_name = any (c.eliminated_teams)
    and not exists (
      select 1
      from public.auction_elimination_refunds r
      where r.auction_id = t.auction_id
        and r.player_id = t.player_id::text
    )
),

logged as (
  insert into public.auction_elimination_refunds (
    auction_id, auction_user_id, player_id, team_name, purchase_price, refund_amount
  )
  select
    auction_id, auction_user_id, player_id, team_name, purchase_price, refund_amount
  from targets
  returning *
),

budgets as (
  update public.auction_users u
  set
    budget_remaining = u.budget_remaining + d.total_refund,
    active_budget    = u.active_budget    + d.total_refund
  from (
    select auction_user_id, sum(refund_amount)::int as total_refund
    from targets
    group by auction_user_id
  ) d
  where u.id = d.auction_user_id
  returning u.id, d.total_refund
),

removed as (
  delete from public.auction_teams t
  using targets tg
  where t.auction_id = tg.auction_id
    and t.auction_user_id = tg.auction_user_id
    and t.player_id::text = tg.player_id
  returning t.auction_id, t.player_id::text as player_id, t.purchase_price
),

lots_owned as (
  update public.auction_lots al
  set
    status                 = 'unsold',
    expires_at             = null,
    current_high_bid_id    = null,
    current_high_bidder_id = null
  from targets tg
  where al.auction_id = tg.auction_id
    and al.player_id = tg.player_id
  returning al.auction_id, al.player_id
),

open_lots as (
  select
    al.auction_id,
    al.player_id,
    al.current_high_bidder_id,
    b.amount as bid_amount
  from public.auction_lots al
  join public.players p
    on p.player_id::text = al.player_id
  join public.auction_bids b
    on b.id = al.current_high_bid_id
  cross join config c
  where al.auction_id = any (c.auction_ids)
    and al.status = 'bidding'
    and p.team_name = any (c.eliminated_teams)
    and al.current_high_bidder_id is not null
),

bid_release as (
  update public.auction_users u
  set active_budget = u.active_budget + ol.bid_amount
  from open_lots ol
  where u.id = ol.current_high_bidder_id
  returning u.id, ol.bid_amount
),

lots_bidding as (
  update public.auction_lots al
  set
    status                 = 'unsold',
    expires_at             = null,
    current_high_bid_id    = null,
    current_high_bidder_id = null
  from open_lots ol
  where al.auction_id = ol.auction_id
    and al.player_id = ol.player_id
  returning al.auction_id, al.player_id
)

select
  (select count(*) from logged)                         as players_refunded,
  (select coalesce(sum(refund_amount), 0) from logged)  as total_refunded,
  (select count(*) from removed)                        as squad_rows_removed,
  (select count(*) from lots_owned)                     as owned_lots_closed,
  (select count(*) from lots_bidding)                   as open_bids_cancelled;

commit;
```

**Expected result row:** counts should match the preview. If `players_refunded = 0`, do not panic on a re-run — it means everything was already processed.

### 4. Verify

**Refunds logged:**

```sql
select
  au.name as manager,
  r.auction_id,
  r.team_name,
  r.player_id,
  r.purchase_price,
  r.refund_amount,
  r.created_at
from public.auction_elimination_refunds r
join public.auction_users au on au.id = r.auction_user_id
where r.auction_id in (5, 6, 7)
order by r.created_at desc, r.auction_id, au.name;
```

**No eliminated-nation players left on squads** (replace team list):

```sql
select au.name, p.team_name, p.player_name, t.purchase_price
from public.auction_teams t
join public.players p on p.player_id::text = t.player_id::text
join public.auction_users au on au.id = t.auction_user_id
where t.auction_id in (5, 6, 7)
  and p.team_name = any (array['Canada', 'Haiti']::text[]);
-- should return 0 rows
```

**Budget sanity check** (managers who received refunds):

```sql
select name, budget_remaining, active_budget, paid_release_used
from public.auction_users
where auction_id = 7
order by name;
```

### 5. Open RO32 bidding (separate step)

After refunds are applied, run the normal **GW transition** steps from `GAMEWEEK_FLOW.md`:

1. Lock GW2 squad snapshot → `gameweek_squads` (if not already done)
2. Reset paid release quotas: `UPDATE auction_users SET paid_release_used = false WHERE auction_id IN (5, 6, 7);`
3. Set RO32 bidding deadlines on `"Auctions"` (`initiation_deadline_at`, `raise_deadline_at`, `hard_deadline_at`) and `is_active = true`

Example pattern (edit timestamps):

```sql
-- See also: scripts/sql/auction-gw3-open-bidding-5-6-7.sql

update public.auction_users
set paid_release_used = false
where auction_id in (5, 6, 7);

update public."Auctions"
set
  initiation_deadline_at = (timestamp '2026-06-XX HH:MM:00' at time zone 'Europe/Dublin'),
  raise_deadline_at      = (timestamp '2026-06-XX HH:MM:00' at time zone 'Europe/Dublin'),
  hard_deadline_at       = (timestamp '2026-06-XX HH:MM:00' at time zone 'Europe/Dublin'),
  is_active              = true
where id in (5, 6, 7);
```

Or use `scripts/setup-auction-gw-state.mjs` for a single auction with `--copy-deadlines-from`.

---

## Staggered eliminations (last group matches)

When some nations are confirmed out **before** the final group kickoff:

1. Run **preview + apply** with the **confirmed** nations only
2. After the last group match, run again with **additional** nations in the array
3. Already-refunded players are skipped automatically via `auction_elimination_refunds`

You can also process **early eliminations** (teams mathematically out mid-week) the same way — the idempotency table prevents double refunds.

---

## Quick checklist (night-of)

- [ ] Final eliminated-nation list confirmed
- [ ] `team_name` spellings verified against `players`
- [ ] Preview query run — totals reviewed
- [ ] Apply query run — counts match preview
- [ ] Verify queries — no eliminated players left on squads
- [ ] Spot-check 2–3 managers' budgets in the app
- [ ] GW snapshot / paid-release reset / RO32 deadlines set
- [ ] Managers notified (optional — not automated in app today)

---

## Edge cases & manual fixes

### Wrong nation in the list

If you refund by mistake, there is **no automated undo**. Reverse manually:

1. Re-insert `auction_teams` row with original `purchase_price`
2. Deduct refund from `budget_remaining` and `active_budget`
3. Delete the row from `auction_elimination_refunds`
4. Set lot back to `sold` if the player should still be owned

### Player released voluntarily before elimination

If a manager already **free-released** an eliminated-nation player, there is nothing to refund — they are not in `auction_teams`.

If they used a **paid release** earlier in the GW, they already received half back; the elimination script will not find them on the squad.

### Transfers

If a player was **traded** after purchase, the current owner in `auction_teams` receives the refund (correct behaviour).

### Cursor / agent assist

When time is tight, message an agent with:

> Nations out: Canada, Haiti, Scotland  
> Auctions: 5, 6, 7

It should return filled **preview** and **apply** blocks using this document.

---

## Future improvements (not built yet)

- App UI or announcements for elimination refunds
- Optional `release_type = 'elimination'` on `auction_releases` (requires CHECK constraint change)
- Automated `gameweek_squads` cleanup for eliminated nations on locked snapshots
- Commissioner admin page: paste nation list → preview → confirm
