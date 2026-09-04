-- Backfill auction_elimination_refunds for players removed after GW3 lock
-- but not logged (e.g. elimination applied before audit table existed).
--
-- Finds GW3 snapshot players from eliminated nations who are no longer on auction_teams.
-- Safe to re-run (skips existing refund rows).

with config as (
  select array[
    'Haiti', 'Turkiye', 'Tunisia', 'Jordan', 'Panama', 'Qatar', 'Czechia'
  ]::text[] as eliminated_teams
)

insert into public.auction_elimination_refunds (
  auction_id,
  auction_user_id,
  player_id,
  team_name,
  purchase_price,
  refund_amount,
  created_at
)
select
  gs.auction_id,
  gs.auction_user_id,
  gs.player_id,
  p.team_name,
  gs.purchase_price,
  (gs.purchase_price + 1) / 2,
  coalesce(
    (select max(r.created_at) from public.auction_elimination_refunds r where r.auction_id = gs.auction_id),
    now()
  )
from public.gameweek_squads gs
join public.players p
  on p.player_id::text = gs.player_id
cross join config c
where gs.game_week_id = 3
  and gs.auction_id in (5, 6, 7)
  and p.team_name = any (c.eliminated_teams)
  and not exists (
    select 1
    from public.auction_teams t
    where t.auction_id = gs.auction_id
      and t.auction_user_id = gs.auction_user_id
      and t.player_id::text = gs.player_id
  )
  and not exists (
    select 1
    from public.auction_elimination_refunds r
    where r.auction_id = gs.auction_id
      and r.player_id = gs.player_id
  );
