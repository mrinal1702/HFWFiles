-- ─── Player Release System ────────────────────────────────────────────────────
--
-- Run this entire file in the Supabase SQL Editor.
--
-- What it adds:
--   1. `paid_release_used` boolean column on `auction_users`
--   2. `auction_releases` audit table
--   3. `release_player` RPC (atomic, validates + releases in one transaction)
--
-- Admin reset between gameweeks:
--   UPDATE auction_users SET paid_release_used = false WHERE auction_id = <id>;
-- ─────────────────────────────────────────────────────────────────────────────


-- 1. Add paid_release_used to auction_users
-- ─────────────────────────────────────────
alter table public.auction_users
  add column if not exists paid_release_used boolean not null default false;


-- 2. Audit table for all releases (paid and free)
-- ─────────────────────────────────────────────────
create table if not exists public.auction_releases (
  id              bigserial primary key,
  auction_id      bigint      not null references "Auctions"(id) on delete cascade,
  auction_user_id bigint      not null references auction_users(id) on delete cascade,
  player_id       text        not null,
  release_type    text        not null check (release_type in ('paid', 'free')),
  purchase_price  int         not null,
  refund_amount   int         not null,
  created_at      timestamptz not null default now()
);

create index if not exists auction_releases_auction_user_idx
  on public.auction_releases (auction_id, auction_user_id);


-- 3. release_player RPC
-- ──────────────────────
-- Parameters:
--   p_auction_id      — the auction (bigint)
--   p_player_id       — FotMob player id (text, matches auction_lots.player_id)
--   p_auction_user_id — the auction_users.id of the releasing manager
--   p_release_type    — 'paid' or 'free'
--
-- Returns jsonb:
--   { "ok": true,  "refund_amount": N }
--   { "ok": false, "error": "<code>" }
--
-- Error codes:
--   invalid_release_type       — p_release_type not in ('paid','free')
--   player_not_owned           — no auction_teams row for this player+user
--   paid_release_already_used  — tried paid release but already used this window
--   paid_release_bidding_closed — paid release only while bidding is open (before hard deadline)
--   auction_not_found          — invalid auction_id
--
-- Refund calculation: ceil(purchase_price / 2) — always a whole number, rounds up
-- for odd prices (e.g. 41 → 21, 40 → 20).
--
-- After a successful release:
--   • auction_teams row deleted (player removed from squad)
--   • auction_lots reset to uninitiated with all bid state cleared (fresh lot)
--   • If paid: budget_remaining and active_budget increased by refund_amount,
--              paid_release_used set to true
--   • auction_releases row inserted for audit

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
  -- Validate release type
  if p_release_type not in ('paid', 'free') then
    return jsonb_build_object('ok', false, 'error', 'invalid_release_type');
  end if;

  -- Lock + fetch the auction_teams row (confirms ownership).
  -- auction_teams.player_id may be integer in production; auction_lots.player_id is text — compare as text.
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

  -- For paid releases, verify bidding is open and the window hasn't been used yet
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

    -- Round up: (price + 1) / 2 in integer arithmetic
    v_refund_amount := (v_purchase_price + 1) / 2;
  else
    -- Lock auction_users for free release too (budget unchanged, but keeps lock order consistent)
    perform id from public.auction_users where id = p_auction_user_id for update;
    v_refund_amount := 0;
  end if;

  -- Remove player from the squad
  delete from public.auction_teams
  where  auction_id      = p_auction_id
    and  player_id::text  = p_player_id
    and  auction_user_id = p_auction_user_id;

  -- Reset the lot to a fresh uninitiated state (as if never sold)
  update public.auction_lots
  set    status                 = 'uninitiated',
         current_high_bid_id    = null,
         current_high_bidder_id = null,
         expires_at             = null
  where  auction_id = p_auction_id
    and  player_id::text = p_player_id;

  -- Apply budget refund and mark paid release used (paid only)
  if p_release_type = 'paid' then
    update public.auction_users
    set    budget_remaining  = budget_remaining  + v_refund_amount,
           active_budget     = active_budget     + v_refund_amount,
           paid_release_used = true
    where  id = p_auction_user_id;
  end if;

  -- Audit record
  insert into public.auction_releases
    (auction_id, auction_user_id, player_id, release_type, purchase_price, refund_amount)
  values
    (p_auction_id, p_auction_user_id, p_player_id, p_release_type, v_purchase_price, v_refund_amount);

  return jsonb_build_object('ok', true, 'refund_amount', v_refund_amount);
end;
$$;

comment on function public.release_player(bigint, text, bigint, text) is
  'Releases an owned player back to the pool. Paid: ceil(price/2) refund once per bidding window, only while bidding is open. Free: no refund, unlimited.';

grant execute on function public.release_player(bigint, text, bigint, text) to authenticated;
grant execute on function public.release_player(bigint, text, bigint, text) to service_role;
