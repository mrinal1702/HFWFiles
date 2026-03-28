-- Bidding schema + place_bid RPC. Run in Supabase SQL Editor (once per project).
-- Requires: "Auctions", auction_users, auction_teams, players (with player_id + position).

-- ---------------------------------------------------------------------------
-- 1) Auction hard deadline
-- ---------------------------------------------------------------------------
alter table public."Auctions"
  add column if not exists hard_deadline_at timestamptz;

comment on column public."Auctions".hard_deadline_at is
  'Global cutoff: no bids at or after this time; rolling 24h expiry is capped to this.';

-- ---------------------------------------------------------------------------
-- 2) Lots (one row per player in an auction pool)
-- ---------------------------------------------------------------------------
create table if not exists public.auction_lots (
  auction_id bigint not null
    references public."Auctions"(id) on delete cascade,
  player_id text not null,
  status text not null
    check (status in ('uninitiated', 'bidding', 'sold', 'unsold')),
  expires_at timestamptz,
  current_high_bid_id bigint,
  current_high_bidder_id bigint
    references public.auction_users(id) on delete restrict,
  primary key (auction_id, player_id)
);

create index if not exists idx_auction_lots_auction_status
  on public.auction_lots (auction_id, status);

comment on table public.auction_lots is
  'Per-player auction state; current_high_bid_id points at winning bid in auction_bids.';

-- ---------------------------------------------------------------------------
-- 3) Bids (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.auction_bids (
  id bigint generated always as identity primary key,
  auction_id bigint not null
    references public."Auctions"(id) on delete cascade,
  player_id text not null,
  auction_user_id bigint not null
    references public.auction_users(id) on delete cascade,
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_auction_bids_auction_player
  on public.auction_bids (auction_id, player_id);

create index if not exists idx_auction_bids_auction_player_created
  on public.auction_bids (auction_id, player_id, created_at desc);

do $$
begin
  alter table public.auction_lots
    add constraint auction_lots_current_high_bid_fk
    foreign key (current_high_bid_id) references public.auction_bids(id) on delete restrict;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Helpers: position checks (master list uses "Goalkeeper", etc.)
-- ---------------------------------------------------------------------------
create or replace function public._player_is_goalkeeper(p_player_id text)
returns boolean
language sql
stable
as $$
  select coalesce(
    (
      select lower(trim(p.position)) in ('gk', 'goalkeeper')
      from public.players p
      where p.player_id::text = p_player_id
      limit 1
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 5) place_bid: single transaction, serialized per lot + bidders
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
  v_now timestamptz := clock_timestamp();
  v_hard timestamptz;
  v_lot record;
  v_prev_bid record;
  v_prev_high integer;
  v_prev_high_bidder bigint;
  v_bidder record;
  v_new_bid_id bigint;
  v_expires timestamptz;
  v_slots_used integer;
  v_need_slot integer;
  v_gk_used integer;
  v_outfield_used integer;
  v_is_gk boolean;
  v_gk_after integer;
  v_outfield_after integer;
begin
  if p_amount is null or p_amount <> floor(p_amount) then
    return jsonb_build_object('ok', false, 'error', 'amount_must_be_integer');
  end if;

  if p_amount < 5 then
    return jsonb_build_object('ok', false, 'error', 'below_minimum_opening_bid');
  end if;

  select a.hard_deadline_at into v_hard
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

  -- Finalize this lot if rolling window already ended (before hard deadline).
  if v_lot.status = 'bidding' and v_lot.expires_at is not null and v_lot.expires_at <= v_now then
    if v_lot.current_high_bid_id is null then
      update public.auction_lots
      set status = 'unsold', expires_at = null, current_high_bid_id = null, current_high_bidder_id = null
      where auction_id = p_auction_id and player_id = p_player_id;
      return jsonb_build_object('ok', false, 'error', 'lot_not_biddable');
    end if;

    select * into v_prev_bid from public.auction_bids b where b.id = v_lot.current_high_bid_id;
    insert into public.auction_teams (auction_id, auction_user_id, player_id, purchase_price)
    values (p_auction_id, v_prev_bid.auction_user_id, p_player_id, v_prev_bid.amount);

    update public.auction_users u
    set budget_remaining = u.budget_remaining - v_prev_bid.amount
    where u.id = v_prev_bid.auction_user_id;

    update public.auction_lots
    set status = 'sold', expires_at = null, current_high_bid_id = null, current_high_bidder_id = null
    where auction_id = p_auction_id and player_id = p_player_id;

    return jsonb_build_object('ok', false, 'error', 'lot_not_biddable');
  end if;

  v_prev_high := 0;
  v_prev_high_bidder := null;
  if v_lot.current_high_bid_id is not null then
    select * into v_prev_bid from public.auction_bids b where b.id = v_lot.current_high_bid_id;
    v_prev_high := v_prev_bid.amount;
    v_prev_high_bidder := v_prev_bid.auction_user_id;
  end if;

  if v_prev_high < 50 then
    if p_amount <= v_prev_high then
      return jsonb_build_object('ok', false, 'error', 'bid_too_low');
    end if;
  else
    if p_amount < v_prev_high + 5 then
      return jsonb_build_object('ok', false, 'error', 'bid_increment_too_small');
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
  'Places one bid under auction rules; locks lot and users; may auto-finalize expired lot.';

grant execute on function public.place_bid(bigint, text, bigint, bigint) to authenticated;
grant execute on function public.place_bid(bigint, text, bigint, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- 6) Optional: test hard deadline (Ireland). Safe to re-run: only fills NULL.
--    Change anytime: update public."Auctions" set hard_deadline_at = ... where id = <n>;
-- ---------------------------------------------------------------------------
update public."Auctions"
set hard_deadline_at = (timestamp '2026-04-06 22:00:00' at time zone 'Europe/Dublin')
where hard_deadline_at is null;

-- ---------------------------------------------------------------------------
-- 7) finalize_auction_hard_deadline: settle all lots at/after hard deadline
-- ---------------------------------------------------------------------------
create or replace function public.finalize_auction_hard_deadline(
  p_auction_id bigint,
  p_force boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_hard timestamptz;
  v_force boolean := coalesce(p_force, false);
  v_lot record;
  v_bid record;
  v_sold integer := 0;
  v_unsold integer := 0;
begin
  select a.hard_deadline_at into v_hard
  from public."Auctions" a
  where a.id = p_auction_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'auction_not_found');
  end if;

  if v_hard is null then
    return jsonb_build_object('ok', false, 'error', 'hard_deadline_not_set');
  end if;

  if not v_force and v_now < v_hard then
    return jsonb_build_object('ok', false, 'error', 'deadline_not_reached');
  end if;

  for v_lot in
    select *
    from public.auction_lots al
    where al.auction_id = p_auction_id
      and al.status in ('uninitiated', 'bidding')
    order by al.player_id
    for update
  loop
    if v_lot.status = 'uninitiated' then
      update public.auction_lots
      set
        status = 'unsold',
        expires_at = null,
        current_high_bid_id = null,
        current_high_bidder_id = null
      where auction_id = p_auction_id and player_id = v_lot.player_id;
      v_unsold := v_unsold + 1;
    elsif v_lot.status = 'bidding' then
      if v_lot.current_high_bid_id is null then
        update public.auction_lots
        set
          status = 'unsold',
          expires_at = null,
          current_high_bid_id = null,
          current_high_bidder_id = null
        where auction_id = p_auction_id and player_id = v_lot.player_id;
        v_unsold := v_unsold + 1;
      else
        select * into v_bid from public.auction_bids b where b.id = v_lot.current_high_bid_id;
        if not found then
          raise exception 'missing_bid_for_lot: %', v_lot.player_id;
        end if;

        if not exists (
          select 1 from public.auction_teams t
          where t.auction_id = p_auction_id and t.player_id = v_lot.player_id
        ) then
          insert into public.auction_teams (auction_id, auction_user_id, player_id, purchase_price)
          values (p_auction_id, v_bid.auction_user_id, v_lot.player_id, v_bid.amount);
        end if;

        update public.auction_users u
        set budget_remaining = u.budget_remaining - v_bid.amount
        where u.id = v_bid.auction_user_id;

        update public.auction_lots
        set
          status = 'sold',
          expires_at = null,
          current_high_bid_id = null,
          current_high_bidder_id = null
        where auction_id = p_auction_id and player_id = v_lot.player_id;
        v_sold := v_sold + 1;
      end if;
    end if;
  end loop;

  update public.auction_users u
  set active_budget = u.budget_remaining
  where u.auction_id = p_auction_id;

  return jsonb_build_object(
    'ok', true,
    'lots_sold', v_sold,
    'lots_unsold', v_unsold,
    'hard_deadline_at', v_hard
  );
end;
$$;

comment on function public.finalize_auction_hard_deadline(bigint, boolean) is
  'After hard deadline: sell all lots with a high bid to auction_teams; mark no-bid lots unsold; sync active_budget. Use p_force=true to run before deadline (admin tests).';

grant execute on function public.finalize_auction_hard_deadline(bigint, boolean) to authenticated;
grant execute on function public.finalize_auction_hard_deadline(bigint, boolean) to service_role;
