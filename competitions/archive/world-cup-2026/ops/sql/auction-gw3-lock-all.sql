-- Lock GW3 squads for ALL production WC auctions (5, 6, 7) + activate GW3 on leaderboards.
-- Safe to re-run snapshot inserts (ON CONFLICT DO NOTHING).
-- Does NOT reopen GW4 bidding or reset paid releases.
--
-- Leaderboard UI: pre–Best XI view (flat squad by listed position; sum of all player scores).
-- Run Best XI / auction_leaderboard publish only after GW3 matches complete.

-- ─── 0) Ensure GW3 exists in Game_Weeks ───────────────────────────────────────
insert into public."Game_Weeks" (id, "GW_Name", "Is_Active")
values (3, 'FIFA World Cup Group Stage GW3', false)
on conflict (id) do update
  set "GW_Name" = excluded."GW_Name";

-- ─── 1) Lock GW3 squads from current auction_teams ───────────────────────────
insert into public.gameweek_squads (
  auction_id,
  game_week_id,
  auction_user_id,
  player_id,
  purchase_price
)
select
  t.auction_id,
  3,
  t.auction_user_id,
  t.player_id::text,
  t.purchase_price
from public.auction_teams t
where t.auction_id in (5, 6, 7)
on conflict (auction_id, game_week_id, auction_user_id, player_id) do nothing;

-- ─── 2) Point leaderboards at GW3 (default tab) ─────────────────────────────
update public."Game_Weeks"
set "Is_Active" = false
where "Is_Active" = true;

update public."Game_Weeks"
set "Is_Active" = true
where id = 3;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- select auction_id, count(*) as gw3_rows
-- from gameweek_squads
-- where game_week_id = 3 and auction_id in (5, 6, 7)
-- group by auction_id
-- order by auction_id;
-- select id, "GW_Name", "Is_Active" from "Game_Weeks" order by id;
