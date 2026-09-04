-- Open R16 bidding for auctions 5, 6, 7 (nation_rolling mode).
-- Safe to re-run (idempotent: ON CONFLICT DO UPDATE on nation deadlines).
--
-- Prerequisites (run in order):
--   1. r16-backup-pre-setup.sql        — verify current state + create backup
--   2. this file
--
-- All 16 R16 nations — deadline rule: hard = kickoff − 1h30, raise = hard − 1h.
-- All times in Europe/Dublin (IST = UTC+1 in July).
--
-- Fixture schedule:
--   Fixture 1  Canada      vs Morocco      04 Jul 18:00  →  raise 15:30  hard 16:30
--   Fixture 1  Morocco     vs Canada       04 Jul 18:00  →  raise 15:30  hard 16:30
--   Fixture 2  France      vs Paraguay     04 Jul 22:00  →  raise 19:30  hard 20:30
--   Fixture 2  Paraguay    vs France       04 Jul 22:00  →  raise 19:30  hard 20:30
--   Fixture 3  Brazil      vs Norway       05 Jul 21:00  →  raise 18:30  hard 19:30
--   Fixture 3  Norway      vs Brazil       05 Jul 21:00  →  raise 18:30  hard 19:30
--   Fixture 4  Mexico      vs England      06 Jul 01:00  →  raise 05-Jul 22:30  hard 05-Jul 23:30
--   Fixture 4  England     vs Mexico       06 Jul 01:00  →  raise 05-Jul 22:30  hard 05-Jul 23:30
--   Fixture 5  Portugal    vs Spain        06 Jul 20:00  →  raise 17:30  hard 18:30
--   Fixture 5  Spain       vs Portugal     06 Jul 20:00  →  raise 17:30  hard 18:30
--   Fixture 6  USA         vs Belgium      07 Jul 01:00  →  raise 06-Jul 22:30  hard 06-Jul 23:30
--   Fixture 6  Belgium     vs USA          07 Jul 01:00  →  raise 06-Jul 22:30  hard 06-Jul 23:30
--   Fixture 7  Argentina   vs Egypt        07 Jul 17:00  →  raise 14:30  hard 15:30
--   Fixture 7  Egypt       vs Argentina    07 Jul 17:00  →  raise 14:30  hard 15:30
--   Fixture 8  Switzerland vs Colombia     07 Jul 21:00  →  raise 18:30  hard 19:30
--   Fixture 8  Colombia    vs Switzerland  07 Jul 21:00  →  raise 18:30  hard 19:30
--
-- Final auction close (global hard_deadline_at): 07 Jul 2026 19:30 Europe/Dublin
--   = Switzerland / Colombia hard deadline (last fixture).

-- ─── 0) Ensure GW5 exists (Is_Active stays false — flipped separately at scoring time) ───
insert into public."Game_Weeks" (id, "GW_Name", "Is_Active")
values (5, 'FIFA World Cup Round of 16', false)
on conflict (id) do update
  set "GW_Name" = excluded."GW_Name";

-- ─── 1) Switch auctions 5, 6, 7 to nation_rolling ────────────────────────────
update public."Auctions"
set
  bidding_deadline_mode  = 'nation_rolling',
  rolling_game_week_id   = 5,
  hard_deadline_at       = (timestamp '2026-07-07 19:30:00' at time zone 'Europe/Dublin'),
  initiation_deadline_at = null,
  raise_deadline_at      = null,
  is_active              = true
where id in (5, 6, 7);

-- ─── 2) Reset paid release quota for R16 window ───────────────────────────────
update public.auction_users
set paid_release_used = false
where auction_id in (5, 6, 7);

-- ─── 3) Re-open unsold lots so managers can bid on R16 nations' players ───────
-- Sold players remain sold. Released/never-bid players (status = 'unsold') go
-- back to uninitiated. Non-R16 nations' players will be visible but place_bid
-- returns nation_not_in_round — this is expected behaviour for now.
update public.auction_lots
set
  status                 = 'uninitiated',
  expires_at             = null,
  current_high_bid_id    = null,
  current_high_bidder_id = null
where auction_id in (5, 6, 7)
  and status = 'unsold';

-- ─── 4) Nation deadlines — 16 nations × 3 auctions = 48 rows ────────────────
-- Delete first to allow clean idempotent re-run.
delete from public.auction_nation_deadlines
where auction_id in (5, 6, 7);

insert into public.auction_nation_deadlines
  (auction_id, team_name, kickoff_at, raise_deadline_at, hard_deadline_at)
select
  a.id                                                    as auction_id,
  n.team_name,
  (n.kickoff_ts at time zone 'Europe/Dublin')             as kickoff_at,
  (n.raise_ts   at time zone 'Europe/Dublin')             as raise_deadline_at,
  (n.hard_ts    at time zone 'Europe/Dublin')             as hard_deadline_at
from public."Auctions" a
cross join (values
  -- Fixture 1: Canada vs Morocco — 04 Jul 2026 18:00 Dublin
  ('Canada',
    timestamp '2026-07-04 18:00:00',
    timestamp '2026-07-04 15:30:00',
    timestamp '2026-07-04 16:30:00'),
  ('Morocco',
    timestamp '2026-07-04 18:00:00',
    timestamp '2026-07-04 15:30:00',
    timestamp '2026-07-04 16:30:00'),

  -- Fixture 2: France vs Paraguay — 04 Jul 2026 22:00 Dublin
  ('France',
    timestamp '2026-07-04 22:00:00',
    timestamp '2026-07-04 19:30:00',
    timestamp '2026-07-04 20:30:00'),
  ('Paraguay',
    timestamp '2026-07-04 22:00:00',
    timestamp '2026-07-04 19:30:00',
    timestamp '2026-07-04 20:30:00'),

  -- Fixture 3: Brazil vs Norway — 05 Jul 2026 21:00 Dublin
  ('Brazil',
    timestamp '2026-07-05 21:00:00',
    timestamp '2026-07-05 18:30:00',
    timestamp '2026-07-05 19:30:00'),
  ('Norway',
    timestamp '2026-07-05 21:00:00',
    timestamp '2026-07-05 18:30:00',
    timestamp '2026-07-05 19:30:00'),

  -- Fixture 4: Mexico vs England — 06 Jul 2026 01:00 Dublin
  -- Hard/raise deadlines fall on 05 Jul (midnight span)
  ('Mexico',
    timestamp '2026-07-06 01:00:00',
    timestamp '2026-07-05 22:30:00',
    timestamp '2026-07-05 23:30:00'),
  ('England',
    timestamp '2026-07-06 01:00:00',
    timestamp '2026-07-05 22:30:00',
    timestamp '2026-07-05 23:30:00'),

  -- Fixture 5: Portugal vs Spain — 06 Jul 2026 20:00 Dublin
  ('Portugal',
    timestamp '2026-07-06 20:00:00',
    timestamp '2026-07-06 17:30:00',
    timestamp '2026-07-06 18:30:00'),
  ('Spain',
    timestamp '2026-07-06 20:00:00',
    timestamp '2026-07-06 17:30:00',
    timestamp '2026-07-06 18:30:00'),

  -- Fixture 6: USA vs Belgium — 07 Jul 2026 01:00 Dublin
  -- Hard/raise deadlines fall on 06 Jul (midnight span)
  ('USA',
    timestamp '2026-07-07 01:00:00',
    timestamp '2026-07-06 22:30:00',
    timestamp '2026-07-06 23:30:00'),
  ('Belgium',
    timestamp '2026-07-07 01:00:00',
    timestamp '2026-07-06 22:30:00',
    timestamp '2026-07-06 23:30:00'),

  -- Fixture 7: Argentina vs Egypt — 07 Jul 2026 17:00 Dublin
  ('Argentina',
    timestamp '2026-07-07 17:00:00',
    timestamp '2026-07-07 14:30:00',
    timestamp '2026-07-07 15:30:00'),
  ('Egypt',
    timestamp '2026-07-07 17:00:00',
    timestamp '2026-07-07 14:30:00',
    timestamp '2026-07-07 15:30:00'),

  -- Fixture 8: Switzerland vs Colombia — 07 Jul 2026 21:00 Dublin
  -- This is the final fixture; hard deadline = global auction close
  ('Switzerland',
    timestamp '2026-07-07 21:00:00',
    timestamp '2026-07-07 18:30:00',
    timestamp '2026-07-07 19:30:00'),
  ('Colombia',
    timestamp '2026-07-07 21:00:00',
    timestamp '2026-07-07 18:30:00',
    timestamp '2026-07-07 19:30:00')

) as n(team_name, kickoff_ts, raise_ts, hard_ts)
where a.id in (5, 6, 7);

-- ─── Verify ───────────────────────────────────────────────────────────────────

-- 1) Auction config (expect: nation_rolling, rolling_game_week_id = 5, is_active = true)
select
  id,
  name,
  is_active,
  bidding_deadline_mode,
  rolling_game_week_id,
  hard_deadline_at at time zone 'Europe/Dublin' as final_hard_dublin,
  initiation_deadline_at,
  raise_deadline_at
from public."Auctions"
where id in (5, 6, 7)
order by id;

-- 2) Nation deadlines — expect 48 rows (16 nations × 3 auctions), ordered by fixture
select
  auction_id,
  team_name,
  raise_deadline_at at time zone 'Europe/Dublin' as raise_dublin,
  hard_deadline_at  at time zone 'Europe/Dublin' as hard_dublin,
  kickoff_at        at time zone 'Europe/Dublin' as kickoff_dublin
from public.auction_nation_deadlines
where auction_id in (5, 6, 7)
order by hard_deadline_at, team_name, auction_id;

-- 3) Nation deadline count (expect 48)
select count(*) as nation_deadline_rows
from public.auction_nation_deadlines
where auction_id in (5, 6, 7);

-- 4) Lot status (unsold → uninitiated; sold unchanged)
select auction_id, status, count(*) as n
from public.auction_lots
where auction_id in (5, 6, 7)
group by auction_id, status
order by auction_id, status;

-- 5) Paid release quota (all should be false = 0 used)
select
  auction_id,
  count(*) as total_managers,
  count(*) filter (where paid_release_used) as paid_release_used_count
from public.auction_users
where auction_id in (5, 6, 7)
group by auction_id
order by auction_id;

-- 6) GW5 exists with Is_Active = false
select id, "GW_Name", "Is_Active"
from public."Game_Weeks"
order by id;
