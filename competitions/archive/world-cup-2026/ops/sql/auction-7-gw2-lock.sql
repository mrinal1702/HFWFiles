-- Auction 7 ONLY: lock GW2 squads + set GW2 as the active game week for leaderboards.
-- Safe to re-run snapshot insert (ON CONFLICT DO NOTHING).
-- Does NOT reopen GW3 bidding or reset paid releases.

-- ─── 1) Lock GW2 squads from current auction_teams ───────────────────────────
insert into public.gameweek_squads (
  auction_id,
  game_week_id,
  auction_user_id,
  player_id,
  purchase_price
)
select
  t.auction_id,
  2,
  t.auction_user_id,
  t.player_id::text,
  t.purchase_price
from public.auction_teams t
where t.auction_id = 7
on conflict (auction_id, game_week_id, auction_user_id, player_id) do nothing;

-- ─── 2) Point leaderboards at GW2 (This Gameweek tab) ───────────────────────
update public."Game_Weeks"
set "Is_Active" = false
where "Is_Active" = true;

update public."Game_Weeks"
set "Is_Active" = true
where id = 2;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- select count(*) from gameweek_squads where auction_id = 7 and game_week_id = 2;
-- select id, "GW_Name", "Is_Active" from "Game_Weeks" order by id;
-- select au.name, count(*) from gameweek_squads gs
-- join auction_users au on au.id = gs.auction_user_id
-- where gs.auction_id = 7 and gs.game_week_id = 2
-- group by au.name order by au.name;
