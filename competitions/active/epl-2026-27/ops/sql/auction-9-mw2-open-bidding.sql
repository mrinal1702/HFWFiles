-- Open MW2 bidding for EPL auction 9.
-- Applied via auction-app/scripts/open-epl-mw2-auction-9.mjs (this file is the audit copy).
--
-- Hard deadline: Fri 28 Aug 2026 18:30 Europe/Dublin (stored as timestamptz).
-- No initiation / raise deadlines.
-- +£100m budget boost (GW1 → GW2, once).
-- Transfer window open.
--
-- Does NOT:
--   • touch gameweek_squads (GW1 snapshots stay frozen for My Points)
--   • change Game_Weeks.Is_Active
--   • reset sold lots

update public.auction_users
set paid_release_used = false
where auction_id = 9;

update public.auction_users
set
  budget_remaining = budget_remaining + 100,
  active_budget    = active_budget + 100
where auction_id = 9;

update public.auction_lots
set
  status                 = 'uninitiated',
  expires_at             = null,
  current_high_bid_id    = null,
  current_high_bidder_id = null
where auction_id = 9
  and status = 'unsold';

update public."Auctions"
set
  initiation_deadline_at = null,
  raise_deadline_at      = null,
  hard_deadline_at       = (timestamp '2026-08-28 18:30:00' at time zone 'Europe/Dublin'),
  is_active              = true,
  transfer_window_open   = true
where id = 9;
