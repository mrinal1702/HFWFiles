-- Auction deadline rules: initiation + raise deadlines
-- Run this once in the Supabase SQL Editor after auction-bidding.sql has been applied.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent; CREATE OR REPLACE updates place_bid in place.

-- ---------------------------------------------------------------------------
-- 1) New deadline columns on Auctions
-- ---------------------------------------------------------------------------

alter table public."Auctions"
  add column if not exists initiation_deadline_at timestamptz;

comment on column public."Auctions".initiation_deadline_at is
  'After this time, players with no bids (uninitiated) can no longer be opened. Only lots already in bidding remain available.';

alter table public."Auctions"
  add column if not exists raise_deadline_at timestamptz;

comment on column public."Auctions".raise_deadline_at is
  'After this time, every bid must raise the current high by at least 5, regardless of amount. Must be after initiation_deadline_at and before hard_deadline_at.';

-- ---------------------------------------------------------------------------
-- 2) Updated place_bid: enforces all three deadline phases
-- ---------------------------------------------------------------------------

create or replace function public.place_bid(
  p_auction_id bigint,
  p_player_id text,
  p_auction_user_id bigint,
  p_amount bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now                timestamptz := clock_timestamp();
  v_hard               timestamptz;
  v_initiation         timestamptz;
  v_raise              timestamptz;
  v_lot                record;
  v_prev_bid           record;
  v_prev_high          integer;
  v_prev_high_bidder   bigint;
  v_bidder             record;
  v_new_bid_id         bigint;
  v_expires            timestamptz;
  v_slots_used         integer;
  v_need_slot          integer;
  v_gk_used            integer;
  v_outfield_used      integer;
  v_is_gk              boolean;
  v_gk_after           integer;
  v_outfield_after     integer;
begin
  if p_amount is null or p_amount <> floor(p_amount) then
    return jsonb_build_object('ok', false, 'error', 'amount_must_be_integer');
  end if;

  if p_amount < 5 then
    return jsonb_build_object('ok', false, 'error', 'below_minimum_opening_bid');
  end if;

  select a.hard_deadline_at, a.initiation_deadline_at, a.raise_deadline_at
  into v_hard, v_initiation, v_raise
  from public."Auctions" a
  where a.id = p_auction_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'auction_not_found');
  end if;

  if v_hard is null then
    return jsonb_build_object('ok', false, 'error', 'hard_deadline_not_set');
  end if;

  if v_now >= v_hard then
    return jsonb_build_object('ok', false, 'error', 'auction_deadline_passed');
  end if;

  select * into v_lot
  from public.auction_lots al
  where al.auction_id = p_auction_id and al.player_id = p_player_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'lot_not_found');
  end if;

  if v_lot.status in ('sold', 'unsold') then
    return jsonb_build_object('ok', false, 'error', 'lot_not_biddable');
  end if;

  -- Finalize this lot if its rolling window already ended (before hard deadline).
  if v_lot.status = 'bidding' and v_lot.expires_at is not null and v_lot.expires_at <= v_now then
    if v_lot.current_high_bid_id is null then
      update public.auction_lots
      set status = 'unsold', expires_at = null, current_high_bid_id = null, current_high_bidder_id = null
      where auction_id = p_auction_id and player_id = p_player_id;
      return jsonb_build_object('ok', false, 'error', 'lot_not_biddable');
    end if;

    select * into v_prev_bid from public.auction_bids b where b.id = v_lot.current_high_bid_id;
    insert into public.auction_teams (auction_id, auction_user_id, player_id, purchase_price)
    values (p_auction_id, v_prev_bid.auction_user_id, p_player_id::integer, v_prev_bid.amount);

    update public.auction_users u
    set budget_remaining = u.budget_remaining - v_prev_bid.amount
    where u.id = v_prev_bid.auction_user_id;

    update public.auction_lots
    set status = 'sold', expires_at = null, current_high_bid_id = null, current_high_bidder_id = null
    where auction_id = p_auction_id and player_id = p_player_id;

    return jsonb_build_object('ok', false, 'error', 'lot_not_biddable');
  end if;

  -- Block new bids on players with no bids once the initiation deadline has passed.
  if v_lot.status = 'uninitiated' and v_initiation is not null and v_now >= v_initiation then
    return jsonb_build_object('ok', false, 'error', 'initiation_deadline_passed');
  end if;

  v_prev_high := 0;
  v_prev_high_bidder := null;
  if v_lot.current_high_bid_id is not null then
    select * into v_prev_bid from public.auction_bids b where b.id = v_lot.current_high_bid_id;
    v_prev_high := v_prev_bid.amount;
    v_prev_high_bidder := v_prev_bid.auction_user_id;
  end if;

  -- Increment rules.
  -- After the raise deadline: every bid must be at least +5 above the current high, no exceptions.
  -- Before the raise deadline: standard rules (any integer above current high below 50; +5 minimum from 50+).
  if v_raise is not null and v_now >= v_raise then
    if p_amount < v_prev_high + 5 then
      return jsonb_build_object('ok', false, 'error', 'bid_increment_too_small');
    end if;
  else
    if v_prev_high < 50 then
      if p_amount <= v_prev_high then
        return jsonb_build_object('ok', false, 'error', 'bid_too_low');
      end if;
    else
      if p_amount < v_prev_high + 5 then
        return jsonb_build_object('ok', false, 'error', 'bid_increment_too_small');
      end if;
    end if;
  end if;

  select * into v_bidder
  from public.auction_users u
  where u.id = p_auction_user_id and u.auction_id = p_auction_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'bidder_not_in_auction');
  end if;

  -- Roster: sold + open leading bids (this lot counts if already leading).
  select
    (select count(*)::integer from public.auction_teams t
      where t.auction_id = p_auction_id and t.auction_user_id = p_auction_user_id)
    +
    (select count(*)::integer from public.auction_lots al
      where al.auction_id = p_auction_id
        and al.status = 'bidding'
        and al.current_high_bidder_id = p_auction_user_id
        and not (al.player_id = p_player_id))
  into v_slots_used;

  v_need_slot := case when v_prev_high_bidder is distinct from p_auction_user_id then 1 else 0 end;

  if v_slots_used + v_need_slot > 18 then
    return jsonb_build_object('ok', false, 'error', 'roster_full');
  end if;

  select public._player_is_goalkeeper(p_player_id) into v_is_gk;

  select
    (select count(*)::integer from public.auction_teams t
      join public.players pl on pl.player_id::text = t.player_id::text
      where t.auction_id = p_auction_id and t.auction_user_id = p_auction_user_id
        and lower(trim(pl.position)) in ('gk', 'goalkeeper'))
    +
    (select count(*)::integer from public.auction_lots al
      where al.auction_id = p_auction_id
        and al.status = 'bidding'
        and al.current_high_bidder_id = p_auction_user_id
        and al.player_id <> p_player_id
        and public._player_is_goalkeeper(al.player_id))
  into v_gk_used;

  select
    (select count(*)::integer from public.auction_teams t
      join public.players pl on pl.player_id::text = t.player_id::text
      where t.auction_id = p_auction_id and t.auction_user_id = p_auction_user_id
        and lower(trim(pl.position)) not in ('gk', 'goalkeeper'))
    +
    (select count(*)::integer from public.auction_lots al
      where al.auction_id = p_auction_id
        and al.status = 'bidding'
        and al.current_high_bidder_id = p_auction_user_id
        and al.player_id <> p_player_id
        and not public._player_is_goalkeeper(al.player_id))
  into v_outfield_used;

  if v_is_gk then
    v_gk_after := v_gk_used + (case when v_prev_high_bidder is distinct from p_auction_user_id then 1 else 0 end);
    if v_gk_after > 1 then
      return jsonb_build_object('ok', false, 'error', 'goalkeeper_cap');
    end if;
  else
    v_outfield_after := v_outfield_used + (case when v_prev_high_bidder is distinct from p_auction_user_id then 1 else 0 end);
    if v_outfield_after > 17 then
      return jsonb_build_object('ok', false, 'error', 'outfield_cap');
    end if;
  end if;

  -- Active budget: must afford new commitment on this lot.
  if v_prev_high_bidder is not distinct from p_auction_user_id then
    if v_bidder.active_budget < (p_amount - v_prev_high) then
      return jsonb_build_object('ok', false, 'error', 'insufficient_active_budget');
    end if;
  else
    if v_bidder.active_budget < p_amount then
      return jsonb_build_object('ok', false, 'error', 'insufficient_active_budget');
    end if;
  end if;

  insert into public.auction_bids (auction_id, player_id, auction_user_id, amount, created_at)
  values (p_auction_id, p_player_id, p_auction_user_id, p_amount, v_now)
  returning id into v_new_bid_id;

  v_expires := v_now + interval '24 hours';
  if v_expires > v_hard then
    v_expires := v_hard;
  end if;

  update public.auction_lots
  set
    status = 'bidding',
    expires_at = v_expires,
    current_high_bid_id = v_new_bid_id,
    current_high_bidder_id = p_auction_user_id
  where auction_id = p_auction_id and player_id = p_player_id;

  -- Release previous leader reserve; apply new bidder reserve.
  if v_prev_high_bidder is not null and v_prev_high_bidder is distinct from p_auction_user_id then
    update public.auction_users
    set active_budget = active_budget + v_prev_high
    where id = v_prev_high_bidder;
  end if;

  if v_prev_high_bidder is not distinct from p_auction_user_id then
    update public.auction_users
    set active_budget = active_budget - (p_amount - v_prev_high)
    where id = p_auction_user_id;
  else
    update public.auction_users
    set active_budget = active_budget - p_amount
    where id = p_auction_user_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'bid_id', v_new_bid_id,
    'expires_at', v_expires
  );
end;
$$;

comment on function public.place_bid(bigint, text, bigint, bigint) is
  'Places one bid under auction rules. Enforces three deadline phases: initiation (no new lots after), raise (always +5 increment after), hard (no bids at all after). Locks lot and users; may auto-finalize an expired rolling-window lot.';

grant execute on function public.place_bid(bigint, text, bigint, bigint) to authenticated;
grant execute on function public.place_bid(bigint, text, bigint, bigint) to service_role;
