-- Paid releases only while the auction bidding window is open.
-- Run once in Supabase SQL Editor (safe to re-run).
--
-- Blocks paid release when:
--   • is_active = false (auction paused), or
--   • hard_deadline_at is null, or
--   • hard_deadline_at has passed (bidding closed)
--
-- Free releases are unchanged.

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

  if p_release_type = 'paid' then
    select a.hard_deadline_at, a.is_active
    into   v_hard, v_active
    from   public."Auctions" a
    where  a.id = p_auction_id;

    if not found then
      return jsonb_build_object('ok', false, 'error', 'auction_not_found');
    end if;

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
  'Releases an owned player. Paid: ceil(price/2) refund once per bidding window, only while bidding is open. Free: no refund, unlimited.';

grant execute on function public.release_player(bigint, text, bigint, text) to authenticated;
grant execute on function public.release_player(bigint, text, bigint, text) to service_role;
