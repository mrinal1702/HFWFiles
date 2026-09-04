-- Lock Round of 16 squads (GW5) for ALL production WC auctions (5, 6, 7) + activate GW5 on leaderboards.
-- Safe to re-run snapshot inserts (ON CONFLICT DO NOTHING).
-- Does NOT reopen next-round bidding or reset paid releases.
--
-- Run after the R16 hard deadline (auction-r16-open-bidding-5-6-7.sql window closes).
-- Snapshots current auction_teams — the live R16 squads managers built during bidding.
--
-- Leaderboard UI: pre–Best XI view (flat squad by listed position; sum of all player scores).
-- Run Best XI / auction_leaderboard publish only after R16 matches complete.

-- ─── 0) Ensure GW5 exists in Game_Weeks ───────────────────────────────────────
insert into public."Game_Weeks" (id, "GW_Name", "Is_Active")
values (5, 'FIFA World Cup Round of 16', false)
on conflict (id) do update
  set "GW_Name" = excluded."GW_Name";

-- ─── 1) Lock R16 squads from current auction_teams ────────────────────────────
insert into public.gameweek_squads (
  auction_id,
  game_week_id,
  auction_user_id,
  player_id,
  purchase_price
)
select
  t.auction_id,
  5,
  t.auction_user_id,
  t.player_id::text,
  t.purchase_price
from public.auction_teams t
where t.auction_id in (5, 6, 7)
on conflict (auction_id, game_week_id, auction_user_id, player_id) do nothing;

-- ─── 2) Point leaderboards at GW5 (This Gameweek tab) ───────────────────────
update public."Game_Weeks"
set "Is_Active" = false
where "Is_Active" = true;

update public."Game_Weeks"
set "Is_Active" = true
where id = 5;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- select auction_id, count(*) as gw5_rows
-- from gameweek_squads
-- where game_week_id = 5 and auction_id in (5, 6, 7)
-- group by auction_id
-- order by auction_id;
-- select id, "GW_Name", "Is_Active" from "Game_Weeks" order by id;
