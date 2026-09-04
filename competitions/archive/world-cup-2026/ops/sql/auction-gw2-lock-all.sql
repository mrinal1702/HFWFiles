-- Lock GW2 squads for ALL production WC auctions (5, 6, 7) + activate GW2 on leaderboards.
-- Safe to re-run snapshot inserts (ON CONFLICT DO NOTHING).
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
where t.auction_id in (5, 6, 7)
on conflict (auction_id, game_week_id, auction_user_id, player_id) do nothing;

-- ─── 2) Point leaderboards at GW2 (This Gameweek tab) ───────────────────────
update public."Game_Weeks"
set "Is_Active" = false
where "Is_Active" = true;

update public."Game_Weeks"
set "Is_Active" = true
where id = 2;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- select auction_id, count(*) as gw2_rows
-- from gameweek_squads
-- where game_week_id = 2 and auction_id in (5, 6, 7)
-- group by auction_id
-- order by auction_id;
-- select id, "GW_Name", "Is_Active" from "Game_Weeks" order by id;
