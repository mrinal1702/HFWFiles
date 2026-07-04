-- Participant relegation — RPC guards. Run after participant-relegation-schema.sql.
-- Safe to re-run (CREATE OR REPLACE / DROP IF EXISTS).

-- Block bids from relegated managers (place_bid inserts into auction_bids).
create or replace function public.trg_auction_bids_block_relegated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.auction_users u
    where u.id = new.auction_user_id
      and coalesce(u.is_relegated, false)
  ) then
    raise exception 'participant_relegated' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists auction_bids_block_relegated on public.auction_bids;
create trigger auction_bids_block_relegated
  before insert on public.auction_bids
  for each row
  execute function public.trg_auction_bids_block_relegated();

-- release_player: add relegation check at top (nation_rolling variant — deployed for auctions 5–7).
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
  v_relegated      boolean;
begin
  if p_release_type not in ('paid', 'free') then
    return jsonb_build_object('ok', false, 'error', 'invalid_release_type');
  end if;

  select coalesce(u.is_relegated, false)
  into v_relegated
  from public.auction_users u
  where u.id = p_auction_user_id and u.auction_id = p_auction_id;

  if coalesce(v_relegated, false) then
    return jsonb_build_object('ok', false, 'error', 'participant_relegated');
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

  insert into public.auction_releases (
    auction_id, auction_user_id, player_id, release_type, purchase_price, refund_amount
  )
  values (
    p_auction_id, p_auction_user_id, p_player_id, p_release_type, v_purchase_price, v_refund_amount
  );

  return jsonb_build_object('ok', true, 'refund_amount', v_refund_amount);
end;
$$;

comment on function public.release_player(bigint, text, bigint, text) is
  'Release owned player. Blocks relegated managers.';

grant execute on function public.release_player(bigint, text, bigint, text) to authenticated;
grant execute on function public.release_player(bigint, text, bigint, text) to service_role;

-- Helper for transfer RPC patches (optional — app layer also blocks relegated managers).
create or replace function public._participant_is_relegated(p_user_id bigint)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select u.is_relegated from public.auction_users u where u.id = p_user_id),
    false
  );
$$;
