-- Lock Semi-Final squads (GW7) for ALL production WC auctions (5, 6, 7) + activate GW7 on leaderboards.
-- Safe to re-run snapshot inserts (ON CONFLICT DO NOTHING).
-- Does NOT reopen next-round bidding or reset paid releases.
--
-- Run after the SF hard deadline (open-nation-rolling-round.mjs / SF bidding window closes).
-- Snapshots current auction_teams — the live SF squads managers built during bidding.
--
-- Leaderboard UI: pre–Best XI view (flat squad by listed position; sum of all player scores).
-- Run Best XI / auction_leaderboard publish only after SF matches complete.
--
-- Equivalent CLI (preferred):
--   node scripts/lock-gameweek-squads.mjs --gw-id 7 --gw-name "FIFA World Cup Semi Finals" --auction-ids 5,6,7

-- ─── 0) Ensure GW7 exists in Game_Weeks ───────────────────────────────────────
insert into public."Game_Weeks" (id, "GW_Name", "Is_Active")
values (7, 'FIFA World Cup Semi Finals', false)
on conflict (id) do update
  set "GW_Name" = excluded."GW_Name";

-- ─── 1) Lock SF squads from current auction_teams ─────────────────────────────
insert into public.gameweek_squads (
  auction_id,
  game_week_id,
  auction_user_id,
  player_id,
  purchase_price
)
select
  t.auction_id,
  7,
  t.auction_user_id,
  t.player_id::text,
  t.purchase_price
from public.auction_teams t
where t.auction_id in (5, 6, 7)
on conflict (auction_id, game_week_id, auction_user_id, player_id) do nothing;

-- ─── 2) Point leaderboards at GW7 (This Gameweek tab) ─────────────────────────
update public."Game_Weeks"
set "Is_Active" = false
where "Is_Active" = true;

update public."Game_Weeks"
set "Is_Active" = true
where id = 7;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- select auction_id, count(*) as gw7_rows
-- from gameweek_squads
-- where game_week_id = 7 and auction_id in (5, 6, 7)
-- group by auction_id
-- order by auction_id;
-- select id, "GW_Name", "Is_Active" from "Game_Weeks" order by id;
