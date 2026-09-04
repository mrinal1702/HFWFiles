-- Open GW3 bidding for auctions 5, 6, 7.
-- Safe to re-run (idempotent updates).
--
-- Deadlines (Europe/Dublin — Wed 24 Jun 2026, before Switzerland vs Canada 20:00):
--   initiation_deadline_at  16:30  (no new lots after)
--   raise_deadline_at       17:30  (+5 minimum raise after)
--   hard_deadline_at        18:30  (bidding closes; lock GW3 squads after this)
--
-- Does NOT:
--   • touch gameweek_squads (GW2 snapshots stay frozen)
--   • apply the GW1→GW2 +£100m budget boost
--   • change Game_Weeks.Is_Active (GW2 leaderboard tab unchanged)

-- ─── 1) Reset paid release quota for GW3 window ─────────────────────────────
update public.auction_users
set paid_release_used = false
where auction_id in (5, 6, 7);

-- ─── 2) Set GW3 bidding deadlines ───────────────────────────────────────────
update public."Auctions"
set
  initiation_deadline_at = (timestamp '2026-06-24 16:30:00' at time zone 'Europe/Dublin'),
  raise_deadline_at      = (timestamp '2026-06-24 17:30:00' at time zone 'Europe/Dublin'),
  hard_deadline_at       = (timestamp '2026-06-24 18:30:00' at time zone 'Europe/Dublin'),
  is_active              = true
where id in (5, 6, 7);

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- select
--   id,
--   name,
--   is_active,
--   initiation_deadline_at,
--   raise_deadline_at,
--   hard_deadline_at,
--   hard_deadline_at at time zone 'Europe/Dublin' as hard_deadline_dublin
-- from public."Auctions"
-- where id in (5, 6, 7)
-- order by id;
--
-- select auction_id, count(*) as gw2_locked_rows
-- from public.gameweek_squads
-- where auction_id in (5, 6, 7) and game_week_id = 2
-- group by auction_id
-- order by auction_id;
