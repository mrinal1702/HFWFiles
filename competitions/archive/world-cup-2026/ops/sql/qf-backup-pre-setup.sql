-- PRE-QF BACKUP — run in Supabase SQL Editor BEFORE auction-qf-open-bidding-5-6-7.sql
-- Read-only: all statements are SELECTs or backup table creates (no auction data modified).
-- Copy each result set somewhere safe before proceeding.

-- ─── 1) Snapshot current auction rows ────────────────────────────────────────
drop table if exists public._backup_auctions_pre_qf;
create table public._backup_auctions_pre_qf as
select *, now() as backed_up_at from public."Auctions" where id in (5, 6, 7);

-- Snapshot current nation deadlines (R16) for rollback.
drop table if exists public._backup_nation_deadlines_pre_qf;
create table public._backup_nation_deadlines_pre_qf as
select *, now() as backed_up_at from public.auction_nation_deadlines where auction_id in (5, 6, 7);

select
  id, name, is_active, bidding_deadline_mode, rolling_game_week_id,
  hard_deadline_at       at time zone 'Europe/Dublin' as hard_dublin,
  initiation_deadline_at at time zone 'Europe/Dublin' as initiation_dublin,
  raise_deadline_at      at time zone 'Europe/Dublin' as raise_dublin
from public."Auctions"
where id in (5, 6, 7)
order by id;

-- ─── 2) Game_Weeks state (expect GW5 active, GW6 not yet created) ─────────────
select id, "GW_Name", "Is_Active" from public."Game_Weeks" order by id;

-- ─── 3) GW squad snapshots — confirm GW5 locked for all 3 auctions ───────────
select auction_id, game_week_id, count(*) as squad_rows
from public.gameweek_squads
where auction_id in (5, 6, 7)
group by auction_id, game_week_id
order by auction_id, game_week_id;

-- ─── 4) Lot status summary post-RO16 (unsold will be re-opened to uninitiated) ─
select auction_id, status, count(*) as n
from public.auction_lots
where auction_id in (5, 6, 7)
group by auction_id, status
order by auction_id, status;

-- ─── 5) Existing nation deadlines (R16 = 48 rows; will be replaced by 24) ─────
select count(*) as existing_nation_deadline_rows
from public.auction_nation_deadlines
where auction_id in (5, 6, 7);

-- ─── 6) Paid release quota state ─────────────────────────────────────────────
select auction_id, count(*) as total_managers,
  count(*) filter (where paid_release_used) as paid_release_used_count
from public.auction_users where auction_id in (5, 6, 7)
group by auction_id order by auction_id;

-- ─── ROLLBACK (run only if the QF setup needs undoing) ───────────────────────
-- update public."Auctions" a
-- set bidding_deadline_mode = b.bidding_deadline_mode,
--     rolling_game_week_id  = b.rolling_game_week_id,
--     hard_deadline_at      = b.hard_deadline_at,
--     initiation_deadline_at= b.initiation_deadline_at,
--     raise_deadline_at     = b.raise_deadline_at,
--     is_active             = b.is_active
-- from public._backup_auctions_pre_qf b where a.id = b.id;
-- delete from public.auction_nation_deadlines where auction_id in (5, 6, 7);
-- insert into public.auction_nation_deadlines (auction_id, team_name, kickoff_at, raise_deadline_at, hard_deadline_at, locked_at)
--   select auction_id, team_name, kickoff_at, raise_deadline_at, hard_deadline_at, locked_at from public._backup_nation_deadlines_pre_qf;
-- delete from public."Game_Weeks" where id = 6;
