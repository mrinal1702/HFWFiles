-- Open pre-GW1 bidding for UCL auction 10.
-- Applied via auction-app/scripts/open-ucl-auction-10-bidding.mjs (this file is the audit copy).
--
-- Hard deadline: Mon 8 Sep 2026 16:15 Europe/Dublin (stored as timestamptz).
-- No initiation / raise deadlines (24h rolling per lot, capped by hard deadline).
-- Transfer window open; no admin approval on transfers.
-- No budget boost (Live Auction 1 budgets preserved).
-- max_participants = 15.
--
-- Does NOT:
--   • touch gameweek_squads (GW1 lock at hard deadline)
--   • change Game_Weeks.Is_Active
--   • reset sold lots or auction_teams

update public.auction_users
set paid_release_used = false
where auction_id = 10;

update public.auction_lots
set
  status                 = 'uninitiated',
  expires_at             = null,
  current_high_bid_id    = null,
  current_high_bidder_id = null
where auction_id = 10
  and status = 'unsold';

update public."Auctions"
set
  initiation_deadline_at          = null,
  raise_deadline_at               = null,
  hard_deadline_at                = (timestamp '2026-09-08 16:15:00' at time zone 'Europe/Dublin'),
  is_active                       = true,
  transfer_window_open            = true,
  transfers_require_admin_approval = false,
  max_participants                = 15
where id = 10;
