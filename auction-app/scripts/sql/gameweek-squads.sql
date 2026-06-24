-- ─── Gameweek Squad Snapshots ─────────────────────────────────────────────────
--
-- Run this file once in the Supabase SQL Editor.
--
-- Stores a point-in-time copy of every participant's squad at each gameweek's
-- hard deadline. This is the authoritative squad for scoring — NOT auction_teams
-- (which is the live/current squad that keeps changing as GW2 bidding opens).
--
-- is_best_xi is null until formation logic runs; the commissioner sets it to
-- true/false per player after running the Python best-XI pipeline.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.gameweek_squads (
  id              bigserial primary key,
  auction_id      bigint      not null references "Auctions"(id) on delete cascade,
  game_week_id    bigint      not null,
  auction_user_id bigint      not null references auction_users(id) on delete cascade,
  player_id       text        not null,
  purchase_price  int         not null,
  -- null = formation logic not yet run; true = in Best XI; false = bench
  is_best_xi      boolean,
  -- GK / D / M / F when in Best XI; null on bench or before publish
  xi_role         text,
  locked_at       timestamptz not null default now(),
  unique (auction_id, game_week_id, auction_user_id, player_id)
);

create index if not exists idx_gws_auction_gw
  on public.gameweek_squads (auction_id, game_week_id);

create index if not exists idx_gws_auction_gw_user
  on public.gameweek_squads (auction_id, game_week_id, auction_user_id);


-- ─── Commissioner operations ──────────────────────────────────────────────────
--
-- 1. LOCK SQUADS at hard deadline (run once per GW, right after deadline hits)
--    Replace <auction_id> and <game_week_id> with actual values.
--    Safe to re-run — ON CONFLICT DO NOTHING prevents duplicates.
--
-- INSERT INTO gameweek_squads (auction_id, game_week_id, auction_user_id, player_id, purchase_price)
-- SELECT
--   t.auction_id,
--   <game_week_id>,
--   t.auction_user_id,
--   t.player_id::text,
--   t.purchase_price
-- FROM auction_teams t
-- WHERE t.auction_id = <auction_id>
-- ON CONFLICT (auction_id, game_week_id, auction_user_id, player_id) DO NOTHING;
--
--
-- 2. MARK BEST XI after formation logic runs (one UPDATE per participant per GW)
--    Run a separate UPDATE per participant with their Best XI player_ids.
--    Replace <user_id>, <gw_id>, <auction_id>, and the player_id array.
--
-- UPDATE gameweek_squads
-- SET is_best_xi = (player_id = ANY(ARRAY['<p1>', '<p2>', '<p3>', ...]))
-- WHERE auction_id  = <auction_id>
--   AND game_week_id = <gw_id>
--   AND auction_user_id = <user_id>;
--
--
-- 3. VERIFY a squad was locked correctly
--
-- SELECT au.name, gs.player_id, gs.purchase_price, gs.is_best_xi
-- FROM gameweek_squads gs
-- JOIN auction_users au ON au.id = gs.auction_user_id
-- WHERE gs.auction_id  = <auction_id>
--   AND gs.game_week_id = <gw_id>
-- ORDER BY au.name, gs.player_id;
