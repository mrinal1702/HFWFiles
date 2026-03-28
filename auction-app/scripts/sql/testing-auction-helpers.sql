-- Helpers for multi-auction testing and replacing managers on one auction.
-- Run in Supabase SQL Editor after: auction-bidding.sql, seed-auction-lots (seed_auction_lots_for_auction),
-- and reset-testing-environment.sql (optional).
--
-- Supabase may enforce UPDATE/DELETE without WHERE (SQLSTATE 21000); all mutations here use scoped WHERE clauses.

-- ---------------------------------------------------------------------------
-- 1) Stack a new auction (same player pool, new auction_id + new managers)
-- ---------------------------------------------------------------------------
create or replace function public.create_stacked_test_auction(
  p_auction_name text,
  p_hard_deadline timestamptz,
  p_user_count integer default 8,
  p_start_budget integer default 350,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id bigint;
  v_lots jsonb;
  i integer;
begin
  if p_auction_name is null or trim(p_auction_name) = '' then
    return jsonb_build_object('ok', false, 'error', 'auction_name_required');
  end if;
  if p_hard_deadline is null then
    return jsonb_build_object('ok', false, 'error', 'hard_deadline_required');
  end if;
  if p_user_count is null or p_user_count < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_user_count');
  end if;
  if p_start_budget is null or p_start_budget < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_budget');
  end if;

  select coalesce(max(a.id), 0) + 1 into v_new_id from public."Auctions" a;

  insert into public."Auctions" (id, name, is_active, hard_deadline_at, join_code, max_participants)
  values (
    v_new_id,
    trim(p_auction_name),
    coalesce(p_is_active, true),
    p_hard_deadline,
    upper(substr(md5(random()::text || clock_timestamp()::text || v_new_id::text), 1, 8)),
    12
  );

  for i in 1..p_user_count loop
    insert into public.auction_users (auction_id, name, budget_remaining, active_budget)
    values (
      v_new_id,
      format('Test manager %s (auction %s)', i, v_new_id),
      p_start_budget,
      p_start_budget
    );
  end loop;

  select public.seed_auction_lots_for_auction(v_new_id) into v_lots;

  return jsonb_build_object(
    'ok', true,
    'auction_id', v_new_id,
    'auction_name', trim(p_auction_name),
    'users_created', p_user_count,
    'seed', v_lots
  );
end;
$$;

comment on function public.create_stacked_test_auction(text, timestamptz, integer, integer, boolean) is
  'Adds a new Auctions row, inserts p_user_count auction_users, seeds all auction_lots from public.players. Does not modify other auctions.';

grant execute on function public.create_stacked_test_auction(text, timestamptz, integer, integer, boolean)
  to authenticated;
grant execute on function public.create_stacked_test_auction(text, timestamptz, integer, integer, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2) Replace all managers on ONE auction and wipe that auction’s bidding state, then re-seed lots
-- ---------------------------------------------------------------------------
create or replace function public.replace_auction_users_fresh_state(
  p_auction_id bigint,
  p_user_count integer,
  p_start_budget integer default 350
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lots jsonb;
  i integer;
begin
  if p_auction_id is null or p_auction_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_auction_id');
  end if;
  if p_user_count is null or p_user_count < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_user_count');
  end if;

  update public.auction_lots al
  set current_high_bid_id = null, current_high_bidder_id = null
  where al.auction_id = p_auction_id
    and al.current_high_bid_id is not null;

  delete from public.auction_bids ab
  where ab.auction_id = p_auction_id;

  delete from public.auction_lots al
  where al.auction_id = p_auction_id;

  delete from public.auction_teams at
  where at.auction_id = p_auction_id;

  delete from public.auction_leaderboard alb
  where alb.auction_id = p_auction_id;

  delete from public.auction_score_breakdown asb
  where asb.auction_id = p_auction_id;

  delete from public.auction_users au
  where au.auction_id = p_auction_id
    and (au.id is not null or au.id is null);

  for i in 1..p_user_count loop
    insert into public.auction_users (auction_id, name, budget_remaining, active_budget)
    values (
      p_auction_id,
      format('Test manager %s (auction %s)', i, p_auction_id),
      p_start_budget,
      p_start_budget
    );
  end loop;

  select public.seed_auction_lots_for_auction(p_auction_id) into v_lots;

  return jsonb_build_object(
    'ok', true,
    'auction_id', p_auction_id,
    'users_created', p_user_count,
    'seed', v_lots
  );
end;
$$;

comment on function public.replace_auction_users_fresh_state(bigint, integer, integer) is
  'For one auction only: clears bids/lots/teams/score rows for that auction_id, removes all auction_users for that auction, inserts p_user_count new users, re-seeds lots from players.';

grant execute on function public.replace_auction_users_fresh_state(bigint, integer, integer)
  to authenticated;
grant execute on function public.replace_auction_users_fresh_state(bigint, integer, integer)
  to service_role;
