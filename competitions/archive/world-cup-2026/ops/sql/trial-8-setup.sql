-- Trial auction 8 — rolling nation deadlines (6 nations, 3 fixtures).
-- SAFE: does NOT touch auctions 5/6/7. Trial GW id 99 has Is_Active = false.
--
-- Prerequisites (run in order):
--   1. trial-8-backup-pre-setup.sql
--   2. nation-rolling-bidding-schema.sql
--   3. nation-rolling-bidding-rpc.sql
--   4. this file
--
-- Join code: TRIALR16 (8 chars — app allows 6–8 only)

-- ─── 0) Trial gameweek (NOT globally active) ─────────────────────────────────
insert into public."Game_Weeks" (id, "GW_Name", "Is_Active")
values (99, 'Trial R16 Rolling', false)
on conflict (id) do update
  set "GW_Name" = excluded."GW_Name",
      "Is_Active" = false;

-- ─── 1) Auction 8 ───────────────────────────────────────────────────────────
insert into public."Auctions" (
  id,
  name,
  is_active,
  hard_deadline_at,
  join_code,
  max_participants,
  bidding_deadline_mode,
  rolling_game_week_id,
  transfer_window_open,
  initiation_deadline_at,
  raise_deadline_at
)
values (
  8,
  'Trial R16 Rolling Deadlines',
  true,
  (timestamp '2026-06-30 21:30:00' at time zone 'Europe/Dublin'),
  'TRIALR16',
  12,
  'nation_rolling',
  99,
  false,
  null,
  null
)
on conflict (id) do update
  set
    name                   = excluded.name,
    is_active              = excluded.is_active,
    hard_deadline_at       = excluded.hard_deadline_at,
    join_code              = excluded.join_code,
    max_participants       = excluded.max_participants,
    bidding_deadline_mode  = excluded.bidding_deadline_mode,
    rolling_game_week_id   = excluded.rolling_game_week_id,
    transfer_window_open   = excluded.transfer_window_open,
    initiation_deadline_at = excluded.initiation_deadline_at,
    raise_deadline_at      = excluded.raise_deadline_at;

-- ─── 2) Test managers (8 seats) ──────────────────────────────────────────────
delete from public.auction_users where auction_id = 8;

insert into public.auction_users (auction_id, name, budget_remaining, active_budget, paid_release_used)
select
  8,
  format('Trial manager %s', i),
  350,
  350,
  false
from generate_series(1, 8) as i;

-- ─── 3) Lots — only 6 trial nations ────────────────────────────────────────
delete from public.auction_lots where auction_id = 8;

insert into public.auction_lots (auction_id, player_id, status)
select
  8,
  trim(pl.player_id::text),
  'uninitiated'
from public.players pl
where pl.team_name in (
  'Brazil',
  'Germany',
  'France',
  'England',
  'Argentina',
  'Portugal'
)
  and trim(coalesce(pl.player_id::text, '')) <> ''
on conflict (auction_id, player_id) do nothing;

-- ─── 4) Nation deadlines (Europe/Dublin) ─────────────────────────────────────
delete from public.auction_nation_deadlines where auction_id = 8;

-- Game 1: Brazil vs Germany — kickoff Sun 29 Jun 2026 21:00
insert into public.auction_nation_deadlines
  (auction_id, team_name, kickoff_at, raise_deadline_at, hard_deadline_at)
values
  (8, 'Brazil',   (timestamp '2026-06-29 21:00:00' at time zone 'Europe/Dublin'),
                 (timestamp '2026-06-29 18:30:00' at time zone 'Europe/Dublin'),
                 (timestamp '2026-06-29 19:30:00' at time zone 'Europe/Dublin')),
  (8, 'Germany',  (timestamp '2026-06-29 21:00:00' at time zone 'Europe/Dublin'),
                 (timestamp '2026-06-29 18:30:00' at time zone 'Europe/Dublin'),
                 (timestamp '2026-06-29 19:30:00' at time zone 'Europe/Dublin'));

-- Game 2: France vs England — kickoff Mon 30 Jun 2026 20:00
insert into public.auction_nation_deadlines
  (auction_id, team_name, kickoff_at, raise_deadline_at, hard_deadline_at)
values
  (8, 'France',   (timestamp '2026-06-30 20:00:00' at time zone 'Europe/Dublin'),
                 (timestamp '2026-06-30 17:30:00' at time zone 'Europe/Dublin'),
                 (timestamp '2026-06-30 18:30:00' at time zone 'Europe/Dublin')),
  (8, 'England',  (timestamp '2026-06-30 20:00:00' at time zone 'Europe/Dublin'),
                 (timestamp '2026-06-30 17:30:00' at time zone 'Europe/Dublin'),
                 (timestamp '2026-06-30 18:30:00' at time zone 'Europe/Dublin'));

-- Game 3: Argentina vs Portugal — kickoff Mon 30 Jun 2026 23:00
insert into public.auction_nation_deadlines
  (auction_id, team_name, kickoff_at, raise_deadline_at, hard_deadline_at)
values
  (8, 'Argentina', (timestamp '2026-06-30 23:00:00' at time zone 'Europe/Dublin'),
                  (timestamp '2026-06-30 20:30:00' at time zone 'Europe/Dublin'),
                  (timestamp '2026-06-30 21:30:00' at time zone 'Europe/Dublin')),
  (8, 'Portugal',  (timestamp '2026-06-30 23:00:00' at time zone 'Europe/Dublin'),
                  (timestamp '2026-06-30 20:30:00' at time zone 'Europe/Dublin'),
                  (timestamp '2026-06-30 21:30:00' at time zone 'Europe/Dublin'));

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- select id, name, bidding_deadline_mode, rolling_game_week_id,
--        hard_deadline_at at time zone 'Europe/Dublin' as final_hard_dublin,
--        join_code
-- from public."Auctions" where id = 8;
--
-- select team_name,
--        raise_deadline_at at time zone 'Europe/Dublin' as raise_dublin,
--        hard_deadline_at at time zone 'Europe/Dublin' as hard_dublin
-- from public.auction_nation_deadlines where auction_id = 8 order by hard_deadline_at, team_name;
--
-- select count(*) as lots from public.auction_lots where auction_id = 8;
--
-- select id, "GW_Name", "Is_Active" from public."Game_Weeks" order by id;
