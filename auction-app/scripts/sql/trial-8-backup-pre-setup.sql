-- PRE-TRIAL BACKUP — run in Supabase SQL Editor BEFORE nation-rolling-bidding-schema.sql
-- Copy query results somewhere safe. Uses only columns that exist before the trial migration.

-- Snapshot Game_Weeks (fresh copy each run)
drop table if exists public._backup_game_weeks_pre_trial8;
create table public._backup_game_weeks_pre_trial8 as
select *, now() as backed_up_at from public."Game_Weeks";

-- Current state — copy these result sets somewhere safe
select id, "GW_Name", "Is_Active"
from public."Game_Weeks"
order by id;

select id, name, is_active, join_code,
       hard_deadline_at at time zone 'Europe/Dublin' as hard_dublin,
       initiation_deadline_at at time zone 'Europe/Dublin' as initiation_dublin,
       raise_deadline_at at time zone 'Europe/Dublin' as raise_dublin
from public."Auctions"
where id in (5, 6, 7)
order by id;

-- Auction 8 may not exist yet (expected before trial-8-setup.sql)
select id, name, is_active, join_code
from public."Auctions"
where id = 8;

select auction_id, game_week_id, count(*) as squad_rows
from public.gameweek_squads
where auction_id in (5, 6, 7)
group by auction_id, game_week_id
order by 1, 2;

-- ROLLBACK trial only (run if you need to remove trial auction 8):
-- delete from public.gameweek_squads where auction_id = 8;
-- delete from public.auction_leaderboard where auction_id = 8;
-- delete from public.auction_releases where auction_id = 8;
-- delete from public.auction_bids where auction_id = 8;
-- delete from public.auction_teams where auction_id = 8;
-- delete from public.auction_lots where auction_id = 8;
-- delete from public.auction_users where auction_id = 8;
-- delete from public.auction_nation_deadlines where auction_id = 8;
-- delete from public."Auctions" where id = 8;
-- delete from public."Game_Weeks" where id = 99;
--
-- If Is_Active was accidentally changed (should NOT happen in trial setup):
-- update public."Game_Weeks" set "Is_Active" = false;
-- update public."Game_Weeks" set "Is_Active" = true where id = 3;
