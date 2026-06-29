-- Nation-rolling bidding RPCs (place_bid, release_player, finalize_due_nation_deadlines).
-- Run AFTER nation-rolling-bidding-schema.sql and auction-deadline-rules.sql.
-- Safe to re-run (CREATE OR REPLACE). Global auctions unchanged unless mode = nation_rolling.

-- ---------------------------------------------------------------------------
-- Helper: player nation (players.team_name)
-- ---------------------------------------------------------------------------

create or replace function public._player_team_name(p_player_id text)
returns text
language sql
stable
set search_path = public
as $$
  select p.team_name
  from public.players p
  where p.player_id::text = p_player_id
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Finalize open lots for one nation + lock owned players into gameweek_squads
-- ---------------------------------------------------------------------------

create or replace function public._finalize_nation_deadline_for_auction(
  p_auction_id bigint,
  p_team_name text,
  p_game_week_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_lot record;
  v_bid record;
  v_sold integer := 0;
  v_unsold integer := 0;
  v_locked integer := 0;
begin
  for v_lot in
    select al.*
    from public.auction_lots al
    join public.players pl on pl.player_id::text = al.player_id
    where al.auction_id = p_auction_id
      and pl.team_name = p_team_name
      and al.status in ('uninitiated', 'bidding')
    order by al.player_id
    for update of al
  loop
    if v_lot.status = 'uninitiated' then
      update public.auction_lots
      set status = 'unsold', expires_at = null, current_high_bid_id = null, current_high_bidder_id = null
      where auction_id = p_auction_id and player_id = v_lot.player_id;
      v_unsold := v_unsold + 1;
    elsif v_lot.status = 'bidding' then
      if v_lot.current_high_bid_id is null then
        update public.auction_lots
        set status = 'unsold', expires_at = null, current_high_bid_id = null, current_high_bidder_id = null
        where auction_id = p_auction_id and player_id = v_lot.player_id;
        v_unsold := v_unsold + 1;
      else
        select * into v_bid from public.auction_bids b where b.id = v_lot.current_high_bid_id;
        if not found then
          raise exception 'missing_bid_for_lot: %', v_lot.player_id;
        end if;

        if not exists (
          select 1 from public.auction_teams t
          where t.auction_id = p_auction_id and t.player_id::text = v_lot.player_id::text
        ) then
          insert into public.auction_teams (auction_id, auction_user_id, player_id, purchase_price)
          values (p_auction_id, v_bid.auction_user_id, v_lot.player_id::integer, v_bid.amount);
        end if;

        update public.auction_users u
        set budget_remaining = u.budget_remaining - v_bid.amount
        where u.id = v_bid.auction_user_id;

        update public.auction_lots
        set status = 'sold', expires_at = null, current_high_bid_id = null, current_high_bidder_id = null
        where auction_id = p_auction_id and player_id = v_lot.player_id;
        v_sold := v_sold + 1;
      end if;
    end if;
  end loop;

  if p_game_week_id is not null then
    insert into public.gameweek_squads (
      auction_id, game_week_id, auction_user_id, player_id, purchase_price
    )
    select
      t.auction_id,
      p_game_week_id,
      t.auction_user_id,
      t.player_id::text,
      t.purchase_price
    from public.auction_teams t
    join public.players pl on pl.player_id::text = t.player_id::text
    where t.auction_id = p_auction_id
      and pl.team_name = p_team_name
    on conflict (auction_id, game_week_id, auction_user_id, player_id) do nothing;

    get diagnostics v_locked = row_count;
  end if;

  update public.auction_nation_deadlines
  set locked_at = coalesce(locked_at, v_now)
  where auction_id = p_auction_id and team_name = p_team_name;

  return jsonb_build_object(
    'ok', true,
    'team_name', p_team_name,
    'lots_sold', v_sold,
    'lots_unsold', v_unsold,
    'squads_locked', v_locked
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Process all nations whose hard deadline has passed (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.finalize_due_nation_deadlines(p_auction_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_mode text;
  v_gw bigint;
  v_hard timestamptz;
  v_now timestamptz := clock_timestamp();
  v_nation record;
  v_results jsonb := '[]'::jsonb;
  v_one jsonb;
  v_sold_total integer := 0;
  v_unsold_total integer := 0;
begin
  select a.bidding_deadline_mode, a.rolling_game_week_id, a.hard_deadline_at
  into v_mode, v_gw, v_hard
  from public."Auctions" a
  where a.id = p_auction_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'auction_not_found');
  end if;

  if v_mode is distinct from 'nation_rolling' then
    return jsonb_build_object('ok', false, 'error', 'not_nation_rolling');
  end if;

  for v_nation in
    select nd.team_name, nd.hard_deadline_at, nd.locked_at
    from public.auction_nation_deadlines nd
    where nd.auction_id = p_auction_id
      and nd.hard_deadline_at <= v_now
      and nd.locked_at is null
    order by nd.hard_deadline_at, nd.team_name
  loop
    v_one := public._finalize_nation_deadline_for_auction(p_auction_id, v_nation.team_name, v_gw);
    v_results := v_results || jsonb_build_array(v_one);
    v_sold_total := v_sold_total + coalesce((v_one->>'lots_sold')::integer, 0);
    v_unsold_total := v_unsold_total + coalesce((v_one->>'lots_unsold')::integer, 0);
  end loop;

  -- After global final deadline: sync active_budget for everyone
  if v_hard is not null and v_now >= v_hard then
    update public.auction_users u
    set active_budget = u.budget_remaining
    where u.auction_id = p_auction_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'nations_processed', jsonb_array_length(v_results),
    'lots_sold', v_sold_total,
    'lots_unsold', v_unsold_total,
    'details', v_results,
    'processed_at', v_now
  );
end;
$$;

grant execute on function public.finalize_due_nation_deadlines(bigint) to authenticated;
grant execute on function public.finalize_due_nation_deadlines(bigint) to service_role;

-- ---------------------------------------------------------------------------
-- place_bid (global + nation_rolling branches)
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
  v_mode               text;
  v_hard               timestamptz;
  v_initiation         timestamptz;
  v_raise              timestamptz;
  v_gw                 bigint;
  v_team               text;
  v_nation_raise       timestamptz;
  v_nation_hard        timestamptz;
  v_lot                record;
  v_prev_bid           record;
  v_prev_high          integer;
  v_prev_high_bidder   bigint;
  v_bidder             record;
  v_new_bid_id         bigint;
  v_expires            timestamptz;
  v_cap                timestamptz;
  v_slots_used         integer;
  v_need_slot          integer;
  v_gk_used            integer;
  v_outfield_used      integer;
  v_is_gk              boolean;
  v_gk_after           integer;
  v_outfield_after     integer;
  v_rolling_interval   interval;
begin
  if p_amount is null or p_amount <> floor(p_amount) then
    return jsonb_build_object('ok', false, 'error', 'amount_must_be_integer');
  end if;

  if p_amount < 5 then
    return jsonb_build_object('ok', false, 'error', 'below_minimum_opening_bid');
  end if;

  select a.hard_deadline_at, a.initiation_deadline_at, a.raise_deadline_at,
         a.bidding_deadline_mode, a.rolling_game_week_id
  into v_hard, v_initiation, v_raise, v_mode, v_gw
  from public."Auctions" a
  where a.id = p_auction_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'auction_not_found');
  end if;

  if v_hard is null then
    return jsonb_build_object('ok', false, 'error', 'hard_deadline_not_set');
  end if;

  v_rolling_interval := case
    when v_mode = 'nation_rolling' then interval '12 hours'
    else interval '24 hours'
  end;

  if v_now >= v_hard then
    return jsonb_build_object('ok', false, 'error', 'auction_deadline_passed');
  end if;

  -- Settle any nations whose deadline has passed before accepting new bids
  if v_mode = 'nation_rolling' then
    perform public.finalize_due_nation_deadlines(p_auction_id);
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

  v_team := public._player_team_name(p_player_id);

  if v_mode = 'nation_rolling' then
    if v_team is null or trim(v_team) = '' then
      return jsonb_build_object('ok', false, 'error', 'nation_not_in_round');
    end if;

    select nd.raise_deadline_at, nd.hard_deadline_at
    into v_nation_raise, v_nation_hard
    from public.auction_nation_deadlines nd
    where nd.auction_id = p_auction_id and nd.team_name = v_team;

    if not found then
      return jsonb_build_object('ok', false, 'error', 'nation_not_in_round');
    end if;

    if v_now >= v_nation_hard then
      return jsonb_build_object('ok', false, 'error', 'nation_deadline_passed');
    end if;
  end if;

  v_cap := case when v_mode = 'nation_rolling' then v_nation_hard else v_hard end;

  -- Finalize this lot if its rolling window already ended (before nation/global hard).
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

  if v_mode = 'global' then
    if v_lot.status = 'uninitiated' and v_initiation is not null and v_now >= v_initiation then
      return jsonb_build_object('ok', false, 'error', 'initiation_deadline_passed');
    end if;
  end if;

  v_prev_high := 0;
  v_prev_high_bidder := null;
  if v_lot.current_high_bid_id is not null then
    select * into v_prev_bid from public.auction_bids b where b.id = v_lot.current_high_bid_id;
    v_prev_high := v_prev_bid.amount;
    v_prev_high_bidder := v_prev_bid.auction_user_id;
  end if;

  if v_mode = 'nation_rolling' then
    if v_now >= v_nation_raise then
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
  else
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
  end if;

  select * into v_bidder
  from public.auction_users u
  where u.id = p_auction_user_id and u.auction_id = p_auction_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'bidder_not_in_auction');
  end if;

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

  v_expires := v_now + v_rolling_interval;
  if v_expires > v_cap then
    v_expires := v_cap;
  end if;

  update public.auction_lots
  set
    status = 'bidding',
    expires_at = v_expires,
    current_high_bid_id = v_new_bid_id,
    current_high_bidder_id = p_auction_user_id
  where auction_id = p_auction_id and player_id = p_player_id;

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
  'Places one bid. global: initiation/raise/hard on Auctions. nation_rolling: per-nation raise/hard, 12h rolling timer, no initiation.';

grant execute on function public.place_bid(bigint, text, bigint, bigint) to authenticated;
grant execute on function public.place_bid(bigint, text, bigint, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- release_player (block release when nation hard deadline passed in rolling mode)
-- ---------------------------------------------------------------------------

create or replace function public.release_player(
  p_auction_id      bigint,
  p_player_id       text,
  p_auction_user_id bigint,
  p_release_type    text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_purchase_price int;
  v_refund_amount  int;
  v_paid_used      boolean;
  v_hard           timestamptz;
  v_active         boolean;
  v_mode           text;
  v_team           text;
  v_nation_hard    timestamptz;
begin
  if p_release_type not in ('paid', 'free') then
    return jsonb_build_object('ok', false, 'error', 'invalid_release_type');
  end if;

  select purchase_price
  into   v_purchase_price
  from   public.auction_teams
  where  auction_id      = p_auction_id
    and  player_id::text  = p_player_id
    and  auction_user_id = p_auction_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'player_not_owned');
  end if;

  select a.hard_deadline_at, a.is_active, a.bidding_deadline_mode
  into v_hard, v_active, v_mode
  from public."Auctions" a
  where a.id = p_auction_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'auction_not_found');
  end if;

  v_team := public._player_team_name(p_player_id);

  if v_mode = 'nation_rolling' and v_team is not null then
    select nd.hard_deadline_at
    into v_nation_hard
    from public.auction_nation_deadlines nd
    where nd.auction_id = p_auction_id and nd.team_name = v_team;

    if found and clock_timestamp() >= v_nation_hard then
      return jsonb_build_object('ok', false, 'error', 'player_nation_locked');
    end if;
  end if;

  if p_release_type = 'paid' then
    if not coalesce(v_active, false)
       or v_hard is null
       or clock_timestamp() >= v_hard then
      return jsonb_build_object('ok', false, 'error', 'paid_release_bidding_closed');
    end if;

    select paid_release_used
    into   v_paid_used
    from   public.auction_users
    where  id = p_auction_user_id
    for update;

    if v_paid_used then
      return jsonb_build_object('ok', false, 'error', 'paid_release_already_used');
    end if;

    v_refund_amount := (v_purchase_price + 1) / 2;
  else
    if v_mode = 'nation_rolling' then
      if v_hard is not null and clock_timestamp() >= v_hard then
        return jsonb_build_object('ok', false, 'error', 'paid_release_bidding_closed');
      end if;
    end if;

    perform id from public.auction_users where id = p_auction_user_id for update;
    v_refund_amount := 0;
  end if;

  delete from public.auction_teams
  where  auction_id      = p_auction_id
    and  player_id::text  = p_player_id
    and  auction_user_id = p_auction_user_id;

  update public.auction_lots
  set    status                 = 'uninitiated',
         current_high_bid_id    = null,
         current_high_bidder_id = null,
         expires_at             = null
  where  auction_id = p_auction_id
    and  player_id::text = p_player_id;

  if p_release_type = 'paid' then
    update public.auction_users
    set    budget_remaining  = budget_remaining  + v_refund_amount,
           active_budget     = active_budget     + v_refund_amount,
           paid_release_used = true
    where  id = p_auction_user_id;
  end if;

  insert into public.auction_releases
    (auction_id, auction_user_id, player_id, release_type, purchase_price, refund_amount)
  values
    (p_auction_id, p_auction_user_id, p_player_id, p_release_type, v_purchase_price, v_refund_amount);

  return jsonb_build_object('ok', true, 'refund_amount', v_refund_amount);
end;
$$;

comment on function public.release_player(bigint, text, bigint, text) is
  'Releases an owned player. nation_rolling: no release (paid or free) after that nation hard deadline.';

grant execute on function public.release_player(bigint, text, bigint, text) to authenticated;
grant execute on function public.release_player(bigint, text, bigint, text) to service_role;
