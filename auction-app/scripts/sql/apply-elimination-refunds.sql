-- Elimination release: remove eliminated-nation players from live squads + half refund.
-- Does NOT touch gameweek_squads (GW3 snapshots stay frozen for scoring).
-- Does NOT consume paid_release_used.
-- Safe to re-run: already-refunded players skipped via auction_elimination_refunds.
--
-- Usage:
--   1. Edit eliminated_teams array below
--   2. Run PREVIEW section (read-only)
--   3. Run APPLY section (transaction)

-- ═══════════════════════════════════════════════════════════════════════════════
-- PREVIEW — who will be affected?
-- ═══════════════════════════════════════════════════════════════════════════════

with config as (
  select
    array[
      'Haiti', 'Turkiye', 'Tunisia', 'Jordan', 'Panama', 'Qatar', 'Czechia'
    ]::text[]         as eliminated_teams,   -- EDIT: add nations as they go out
    array[5, 6, 7]::bigint[]                 as auction_ids
)

select
  au.name              as manager,
  c.auction_id,
  p.team_name          as nation,
  p.player_name,
  t.player_id::text    as player_id,
  t.purchase_price,
  (t.purchase_price + 1) / 2 as refund_amount
from public.auction_teams t
join public.players p
  on p.player_id::text = t.player_id::text
join public.auction_users au
  on au.id = t.auction_user_id
cross join config c
where t.auction_id = any (c.auction_ids)
  and p.team_name = any (c.eliminated_teams)
  and not exists (
    select 1
    from public.auction_elimination_refunds r
    where r.auction_id = t.auction_id
      and r.player_id = t.player_id::text
  )
order by c.auction_id, p.team_name, au.name, p.player_name;


-- ═══════════════════════════════════════════════════════════════════════════════
-- APPLY — remove players, credit refunds, close lots (run as one transaction)
-- ═══════════════════════════════════════════════════════════════════════════════

begin;

with config as (
  select
    array[
      'Haiti', 'Turkiye', 'Tunisia', 'Jordan', 'Panama', 'Qatar', 'Czechia'
    ]::text[]         as eliminated_teams,   -- EDIT: same list as preview
    array[5, 6, 7]::bigint[]                 as auction_ids
),

targets as (
  select
    t.auction_id,
    t.auction_user_id,
    t.player_id::text as player_id,
    t.purchase_price,
    p.team_name,
    (t.purchase_price + 1) / 2 as refund_amount
  from public.auction_teams t
  join public.players p
    on p.player_id::text = t.player_id::text
  cross join config c
  where t.auction_id = any (c.auction_ids)
    and p.team_name = any (c.eliminated_teams)
    and not exists (
      select 1
      from public.auction_elimination_refunds r
      where r.auction_id = t.auction_id
        and r.player_id = t.player_id::text
    )
),

logged as (
  insert into public.auction_elimination_refunds (
    auction_id, auction_user_id, player_id, team_name, purchase_price, refund_amount
  )
  select
    auction_id, auction_user_id, player_id, team_name, purchase_price, refund_amount
  from targets
  returning *
),

budgets as (
  update public.auction_users u
  set
    budget_remaining = u.budget_remaining + d.total_refund,
    active_budget    = u.active_budget    + d.total_refund
  from (
    select auction_user_id, sum(refund_amount)::int as total_refund
    from targets
    group by auction_user_id
  ) d
  where u.id = d.auction_user_id
  returning u.id, d.total_refund
),

removed as (
  delete from public.auction_teams t
  using targets tg
  where t.auction_id = tg.auction_id
    and t.auction_user_id = tg.auction_user_id
    and t.player_id::text = tg.player_id
  returning t.auction_id, t.player_id::text as player_id, t.purchase_price
),

lots_owned as (
  update public.auction_lots al
  set
    status                 = 'unsold',
    expires_at             = null,
    current_high_bid_id    = null,
    current_high_bidder_id = null
  from targets tg
  where al.auction_id = tg.auction_id
    and al.player_id = tg.player_id
  returning al.auction_id, al.player_id
),

open_lots as (
  select
    al.auction_id,
    al.player_id,
    al.current_high_bidder_id,
    b.amount as bid_amount
  from public.auction_lots al
  join public.players p
    on p.player_id::text = al.player_id
  join public.auction_bids b
    on b.id = al.current_high_bid_id
  cross join config c
  where al.auction_id = any (c.auction_ids)
    and al.status = 'bidding'
    and p.team_name = any (c.eliminated_teams)
    and al.current_high_bidder_id is not null
),

bid_release as (
  update public.auction_users u
  set active_budget = u.active_budget + ol.bid_amount
  from open_lots ol
  where u.id = ol.current_high_bidder_id
  returning u.id, ol.bid_amount
),

lots_bidding as (
  update public.auction_lots al
  set
    status                 = 'unsold',
    expires_at             = null,
    current_high_bid_id    = null,
    current_high_bidder_id = null
  from open_lots ol
  where al.auction_id = ol.auction_id
    and al.player_id = ol.player_id
  returning al.auction_id, al.player_id
)

select
  (select count(*) from logged)                         as players_refunded,
  (select coalesce(sum(refund_amount), 0) from logged)  as total_refunded,
  (select count(*) from removed)                        as squad_rows_removed,
  (select count(*) from lots_owned)                     as owned_lots_closed,
  (select count(*) from lots_bidding)                   as open_bids_cancelled;

commit;
