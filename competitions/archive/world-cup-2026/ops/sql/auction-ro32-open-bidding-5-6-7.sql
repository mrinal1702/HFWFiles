-- Open RO32 bidding for auctions 5, 6, 7.
-- Safe to re-run (idempotent updates).
--
-- Anchor: first RO32 match — TBD vs Canada, Sun 28 Jun 2026 20:00 Europe/Dublin
--
-- Deadlines (Europe/Dublin — Sun 28 Jun 2026):
--   initiation_deadline_at  16:30  (no new lots after)
--   raise_deadline_at       17:30  (+5 minimum raise after)
--   hard_deadline_at        18:30  (bidding closes; lock RO32 squads after this)
--
-- Does NOT:
--   • touch gameweek_squads (GW1/GW2/GW3 snapshots stay frozen)
--   • eliminate nations from the player pool (managers self-manage)
--   • change Game_Weeks.Is_Active (GW3 leaderboard tab unchanged until RO32 lock)
--   • reset sold lots (owned players stay sold)

-- ─── 1) Reset paid release quota for RO32 window ─────────────────────────────
update public.auction_users
set paid_release_used = false
where auction_id in (5, 6, 7);

-- ─── 2) Re-open unsold lots for bidding ──────────────────────────────────────
-- After GW3 hard-deadline finalize, never-bid players are status = 'unsold'
-- (not biddable). Reset them to uninitiated so managers can open bids again.
-- Released players are already uninitiated; sold players are left unchanged.
update public.auction_lots
set
  status                 = 'uninitiated',
  expires_at             = null,
  current_high_bid_id    = null,
  current_high_bidder_id = null
where auction_id in (5, 6, 7)
  and status = 'unsold';

-- ─── 3) Set RO32 bidding deadlines ───────────────────────────────────────────
update public."Auctions"
set
  initiation_deadline_at = (timestamp '2026-06-28 16:30:00' at time zone 'Europe/Dublin'),
  raise_deadline_at      = (timestamp '2026-06-28 17:30:00' at time zone 'Europe/Dublin'),
  hard_deadline_at       = (timestamp '2026-06-28 18:30:00' at time zone 'Europe/Dublin'),
  is_active              = true
where id in (5, 6, 7);

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- select
--   id,
--   name,
--   is_active,
--   initiation_deadline_at at time zone 'Europe/Dublin' as initiation_dublin,
--   raise_deadline_at      at time zone 'Europe/Dublin' as raise_dublin,
--   hard_deadline_at       at time zone 'Europe/Dublin' as hard_dublin
-- from public."Auctions"
-- where id in (5, 6, 7)
-- order by id;
--
-- select auction_id, status, count(*) as n
-- from public.auction_lots
-- where auction_id in (5, 6, 7)
-- group by auction_id, status
-- order by auction_id, status;
--
-- select auction_id, count(*) as gw3_locked_rows
-- from public.gameweek_squads
-- where auction_id in (5, 6, 7) and game_week_id = 3
-- group by auction_id
-- order by auction_id;
