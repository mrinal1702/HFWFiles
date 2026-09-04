-- PRE-R16 BACKUP — run in Supabase SQL Editor BEFORE auction-r16-open-bidding-5-6-7.sql
-- Read-only: all statements are SELECTs or backup table creates (no auction data modified).
-- Copy each result set somewhere safe before proceeding.

-- ─── 1) Snapshot current auction rows ────────────────────────────────────────
drop table if exists public._backup_auctions_pre_r16;
create table public._backup_auctions_pre_r16 as
select *, now() as backed_up_at from public."Auctions" where id in (5, 6, 7);

select
  id,
  name,
  is_active,
  bidding_deadline_mode,
  rolling_game_week_id,
  hard_deadline_at       at time zone 'Europe/Dublin' as hard_dublin,
  initiation_deadline_at at time zone 'Europe/Dublin' as initiation_dublin,
  raise_deadline_at      at time zone 'Europe/Dublin' as raise_dublin
from public."Auctions"
where id in (5, 6, 7)
order by id;

-- ─── 2) Game_Weeks state ──────────────────────────────────────────────────────
-- Expect: GW4 active, GW5 does not exist yet (or exists with Is_Active = false)
select id, "GW_Name", "Is_Active"
from public."Game_Weeks"
order by id;

-- ─── 3) GW squad snapshots — confirm GW4 is locked for all 3 auctions ────────
select auction_id, game_week_id, count(*) as squad_rows
from public.gameweek_squads
where auction_id in (5, 6, 7)
group by auction_id, game_week_id
order by auction_id, game_week_id;

-- ─── 4) Lot status summary post-RO32 ─────────────────────────────────────────
-- Expect: sold + unsold (no bidding-state lots). Unsold will be re-opened to uninitiated.
select auction_id, status, count(*) as n
from public.auction_lots
where auction_id in (5, 6, 7)
group by auction_id, status
order by auction_id, status;

-- ─── 5) Existing nation deadlines for auctions 5/6/7 (should be empty) ───────
select count(*) as existing_nation_deadline_rows
from public.auction_nation_deadlines
where auction_id in (5, 6, 7);

-- ─── 6) Paid release quota state ─────────────────────────────────────────────
select
  auction_id,
  count(*) as total_managers,
  count(*) filter (where paid_release_used) as paid_release_used_count
from public.auction_users
where auction_id in (5, 6, 7)
group by auction_id
order by auction_id;

-- ─── 7) Schema health check — confirm nation_rolling columns exist ────────────
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'Auctions'
  and column_name in ('bidding_deadline_mode', 'rolling_game_week_id')
order by column_name;

-- ─── 8) RPC health check — confirm all three RPCs are deployed ───────────────
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('place_bid', 'release_player', 'finalize_due_nation_deadlines')
order by routine_name;

-- ─── ROLLBACK (auction-r16-open-bidding-5-6-7.sql only — run if needed) ──────
-- Restores auctions 5/6/7 to their pre-R16 state from the backup table.
-- Only run this if something went wrong and you need to undo the setup script.
--
-- update public."Auctions" a
-- set
--   bidding_deadline_mode  = b.bidding_deadline_mode,
--   rolling_game_week_id   = b.rolling_game_week_id,
--   hard_deadline_at       = b.hard_deadline_at,
--   initiation_deadline_at = b.initiation_deadline_at,
--   raise_deadline_at      = b.raise_deadline_at,
--   is_active              = b.is_active
-- from public._backup_auctions_pre_r16 b
-- where a.id = b.id;
--
-- delete from public.auction_nation_deadlines where auction_id in (5, 6, 7);
-- delete from public."Game_Weeks" where id = 5;
