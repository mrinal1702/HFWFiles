-- Open MW3 bidding for EPL auction 9.
-- Applied via auction-app/scripts/open-epl-mw3-auction-9.mjs (this file is the audit copy).
--
-- Hard deadline: Fri 4 Sep 2026 18:30 Europe/Dublin (90 min before MW3 kickoff).
-- No initiation / raise deadlines.
-- No budget boost (GW2 → GW3).
-- Transfer window open.
--
-- Does NOT:
--   • touch gameweek_squads (GW1/GW2 snapshots stay frozen for My Points)
--   • change Game_Weeks.Is_Active
--   • reset sold lots
--   • change budgets

update public.auction_users
set paid_release_used = false
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
  hard_deadline_at       = (timestamp '2026-09-04 18:30:00' at time zone 'Europe/Dublin'),
  is_active              = true,
  transfer_window_open   = true
where id = 9;
