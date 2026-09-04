-- Permanently delete trial auction 8 (Trial R16 Rolling Deadlines / TRIALR16)
-- and trial Game_Week 99. Does NOT touch auctions 5/6/7.
-- Prefer: node scripts/delete-trial-auction-8.mjs
-- Or run this whole file in Supabase SQL Editor.

begin;

update public.auction_lots
set current_high_bid_id = null, current_high_bidder_id = null
where auction_id = 8;

delete from public.auction_transfers where auction_id = 8;
delete from public.auction_elimination_refunds where auction_id = 8;
delete from public.auction_participant_relegations where auction_id = 8;
delete from public.auction_releases where auction_id = 8;
delete from public.auction_score_breakdown where auction_id = 8;
delete from public.auction_leaderboard where auction_id = 8;
delete from public.gameweek_squads where auction_id = 8;
delete from public.auction_bids where auction_id = 8;
delete from public.auction_teams where auction_id = 8;
delete from public.auction_lots where auction_id = 8;
delete from public.auction_nation_deadlines where auction_id = 8;
delete from public.auction_users where auction_id = 8;
delete from public."Auctions" where id = 8;
delete from public."Game_Weeks" where id = 99;

drop table if exists public._backup_game_weeks_pre_trial8;

commit;

-- Verify
select id, name from public."Auctions" where id in (5, 6, 7, 8) order by id;
select count(*) as trial8_users from public.auction_users where auction_id = 8;
