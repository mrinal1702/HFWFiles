-- Paste this ENTIRE file into Supabase → SQL Editor → Run once.
-- Do not mix with other snippets; replaces only public.finalize_auction_hard_deadline.
-- After run, verify the insert line contains: v_lot.player_id::integer
--   (SQL Editor → run: select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n ...)

-- ---------------------------------------------------------------------------
-- finalize_auction_hard_deadline: settle all lots at/after hard deadline
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

        -- auction_lots.player_id may be text; auction_teams.player_id int4 — compare as text, insert as int.
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
