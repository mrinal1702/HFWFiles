-- Auction 7 ONLY: lock GW1 squads + open GW2 bidding (same deadlines as auction 5/6).
-- Safe to re-run snapshot insert (ON CONFLICT DO NOTHING).
-- Does NOT touch auctions 5 or 6.

-- ─── 1) Lock GW1 squads from current auction_teams ───────────────────────────
insert into public.gameweek_squads (
  auction_id,
  game_week_id,
  auction_user_id,
  player_id,
  purchase_price
)
select
  t.auction_id,
  1,
  t.auction_user_id,
  t.player_id::text,
  t.purchase_price
from public.auction_teams t
where t.auction_id = 7
on conflict (auction_id, game_week_id, auction_user_id, player_id) do nothing;

-- ─── 2) Reset paid release quota for GW2 window ───────────────────────────────
update public.auction_users
set paid_release_used = false
where auction_id = 7;

-- ─── 3) Copy GW2 bidding deadlines from auction 5 (same as auction 6) ─────────
update public."Auctions" a7
set
  initiation_deadline_at = src.initiation_deadline_at,
  raise_deadline_at      = src.raise_deadline_at,
  hard_deadline_at       = src.hard_deadline_at,
  is_active              = true
from public."Auctions" src
where a7.id = 7
  and src.id = 5;

-- ─── 4) OPTIONAL: GW1→GW2 budget boost (+100 once) ───────────────────────────
-- Only run if your manually-set budgets do NOT already include the boost.
-- update public.auction_users
-- set budget_remaining = budget_remaining + 100,
--     active_budget    = active_budget    + 100
-- where auction_id = 7;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- select count(*) from gameweek_squads where auction_id = 7 and game_week_id = 1;
-- select id, name, hard_deadline_at, initiation_deadline_at, raise_deadline_at
-- from "Auctions" where id in (5, 6, 7);
