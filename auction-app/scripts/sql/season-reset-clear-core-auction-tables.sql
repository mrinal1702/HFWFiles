-- Season reset: empty core auction tables (Supabase SQL Editor → run whole file).
-- Order: break lot→bid FK (RESTRICT), then bids, lots, teams; then members; then auctions.
--
-- Clearing public."Auctions" while auction_users.auction_id still points at those rows
-- will fail on a normal FK — so this script deletes auction_users first. Auth profiles
-- (public.profiles / auth.users) are NOT touched.

begin;

update public.auction_lots
set current_high_bid_id = null, current_high_bidder_id = null
where auction_id is not null
   or auction_id is null;

-- auction_bids has surrogate id
delete from public.auction_bids
where id is not null
   or id is null;

-- auction_lots: composite PK (auction_id, player_id); tautology WHERE for strict policies
delete from public.auction_lots
where auction_id is not null
   or auction_id is null;

delete from public.auction_teams
where auction_id is not null
   or auction_id is null;

-- Required before deleting Auctions if auction_users.auction_id → Auctions(id)
delete from public.auction_users
where id is not null
   or id is null;

delete from public."Auctions"
where id is not null
   or id is null;

commit;
