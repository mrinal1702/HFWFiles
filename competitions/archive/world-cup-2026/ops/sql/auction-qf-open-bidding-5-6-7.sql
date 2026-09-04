-- Open Quarter-Final (GW6) bidding for auctions 5, 6, 7 (nation_rolling mode).
-- Safe to re-run (idempotent: nation deadlines are delete + re-insert).
--
-- Prerequisites (run in order):
--   1. qf-backup-pre-setup.sql          — verify current state + create backup
--   2. this file
--
-- 8 QF nations — deadline rule: hard = kickoff - 1h30, raise = hard - 1h.
-- All times in Europe/Dublin (IST = UTC+1 in July).
--
-- Fixture schedule:
--   France      vs Morocco      09 Jul 21:00  →  raise 18:30       hard 19:30
--   Spain       vs Belgium      10 Jul 20:00  →  raise 17:30       hard 18:30
--   Norway      vs England      11 Jul 22:00  →  raise 19:30       hard 20:30
--   Argentina   vs Switzerland  12 Jul 02:00  →  raise 11-Jul 23:30 hard 12-Jul 00:30
--
-- Final auction close (global hard_deadline_at): 12 Jul 2026 00:30 Europe/Dublin
--   = Argentina / Switzerland hard deadline (last fixture).

-- ─── 0) Ensure GW6 exists and set it active (RO16 wrapped up) ─────────────────
insert into public."Game_Weeks" (id, "GW_Name", "Is_Active")
values (6, 'FIFA World Cup Quarter Finals', false)
on conflict (id) do update
  set "GW_Name" = excluded."GW_Name";

update public."Game_Weeks" set "Is_Active" = false where "Is_Active" = true;
update public."Game_Weeks" set "Is_Active" = true  where id = 6;

-- ─── 1) Switch auctions 5, 6, 7 to nation_rolling for GW6 ─────────────────────
update public."Auctions"
set
  bidding_deadline_mode  = 'nation_rolling',
  rolling_game_week_id   = 6,
  hard_deadline_at       = (timestamp '2026-07-12 00:30:00' at time zone 'Europe/Dublin'),
  initiation_deadline_at = null,
  raise_deadline_at      = null,
  is_active              = true
where id in (5, 6, 7);

-- ─── 2) Reset paid release quota for the QF window ───────────────────────────
update public.auction_users
set paid_release_used = false
where auction_id in (5, 6, 7);

-- ─── 3) Re-open unsold lots so managers can bid on QF nations' players ────────
-- Sold players remain sold. Released/eliminated/never-bid players (status = 'unsold')
-- go back to uninitiated. Non-QF nations' players stay visible but place_bid
-- returns nation_not_in_round — expected behaviour.
update public.auction_lots
set
  status                 = 'uninitiated',
  expires_at             = null,
  current_high_bid_id    = null,
  current_high_bidder_id = null
where auction_id in (5, 6, 7)
  and status = 'unsold';

-- ─── 4) Nation deadlines — 8 nations × 3 auctions = 24 rows ───────────────────
delete from public.auction_nation_deadlines
where auction_id in (5, 6, 7);

insert into public.auction_nation_deadlines
  (auction_id, team_name, kickoff_at, raise_deadline_at, hard_deadline_at)
select
  a.id                                          as auction_id,
  n.team_name,
  (n.kickoff_ts at time zone 'Europe/Dublin')   as kickoff_at,
  (n.raise_ts   at time zone 'Europe/Dublin')   as raise_deadline_at,
  (n.hard_ts    at time zone 'Europe/Dublin')   as hard_deadline_at
from public."Auctions" a
cross join (values
  -- Fixture 1: France vs Morocco — 09 Jul 2026 21:00 Dublin
  ('France',      timestamp '2026-07-09 21:00:00', timestamp '2026-07-09 18:30:00', timestamp '2026-07-09 19:30:00'),
  ('Morocco',     timestamp '2026-07-09 21:00:00', timestamp '2026-07-09 18:30:00', timestamp '2026-07-09 19:30:00'),

  -- Fixture 2: Spain vs Belgium — 10 Jul 2026 20:00 Dublin
  ('Spain',       timestamp '2026-07-10 20:00:00', timestamp '2026-07-10 17:30:00', timestamp '2026-07-10 18:30:00'),
  ('Belgium',     timestamp '2026-07-10 20:00:00', timestamp '2026-07-10 17:30:00', timestamp '2026-07-10 18:30:00'),

  -- Fixture 3: Norway vs England — 11 Jul 2026 22:00 Dublin
  ('Norway',      timestamp '2026-07-11 22:00:00', timestamp '2026-07-11 19:30:00', timestamp '2026-07-11 20:30:00'),
  ('England',     timestamp '2026-07-11 22:00:00', timestamp '2026-07-11 19:30:00', timestamp '2026-07-11 20:30:00'),

  -- Fixture 4: Argentina vs Switzerland — 12 Jul 2026 02:00 Dublin (deadlines fall on 11 Jul)
  ('Argentina',   timestamp '2026-07-12 02:00:00', timestamp '2026-07-11 23:30:00', timestamp '2026-07-12 00:30:00'),
  ('Switzerland', timestamp '2026-07-12 02:00:00', timestamp '2026-07-11 23:30:00', timestamp '2026-07-12 00:30:00')
) as n(team_name, kickoff_ts, raise_ts, hard_ts)
where a.id in (5, 6, 7);

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- select id, name, is_active, bidding_deadline_mode, rolling_game_week_id,
--        hard_deadline_at at time zone 'Europe/Dublin' as final_hard_dublin
-- from public."Auctions" where id in (5,6,7) order by id;
--
-- select auction_id, team_name,
--        raise_deadline_at at time zone 'Europe/Dublin' as raise_dublin,
--        hard_deadline_at  at time zone 'Europe/Dublin' as hard_dublin,
--        kickoff_at        at time zone 'Europe/Dublin' as kickoff_dublin
-- from public.auction_nation_deadlines where auction_id in (5,6,7)
-- order by hard_deadline_at, team_name, auction_id;
--
-- select count(*) from public.auction_nation_deadlines where auction_id in (5,6,7); -- expect 24
-- select id, "GW_Name", "Is_Active" from public."Game_Weeks" order by id;
