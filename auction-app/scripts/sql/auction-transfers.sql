-- auction-transfers.sql
-- Run in Supabase SQL Editor AFTER auction-bidding.sql has been applied.
-- Adds peer-to-peer transfer system with state machine + atomic execution.

-- ---------------------------------------------------------------------------
-- 1. Auctions: admin approval toggle
-- ---------------------------------------------------------------------------
alter table public."Auctions"
  add column if not exists transfers_require_admin_approval boolean not null default false;

comment on column public."Auctions".transfers_require_admin_approval is
  'When true, all transfers need admin approval before executing. Cash-only transfers always require admin regardless.';

-- ---------------------------------------------------------------------------
-- 2. auction_transfers table
-- ---------------------------------------------------------------------------
create table if not exists public.auction_transfers (
  id                    uuid primary key default gen_random_uuid(),
  auction_id            bigint not null
    references public."Auctions"(id) on delete cascade,
  proposer_id           bigint not null
    references public.auction_users(id) on delete restrict,
  recipient_id          bigint not null
    references public.auction_users(id) on delete restrict,
  proposer_player_ids   text[] not null default '{}',
  proposer_cash         integer not null default 0 check (proposer_cash >= 0),
  recipient_player_ids  text[] not null default '{}',
  recipient_cash        integer not null default 0 check (recipient_cash >= 0),
  status                text not null default 'awaiting_response'
    check (status in ('awaiting_response','awaiting_confirmation','pending_admin','completed','rejected','cancelled')),
  proposer_confirmed    boolean not null default false,
  recipient_confirmed   boolean not null default false,
  admin_approved        boolean,
  summary               text,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz,
  constraint proposer_recipient_differ check (proposer_id <> recipient_id)
);

create index if not exists idx_auction_transfers_auction_status
  on public.auction_transfers (auction_id, status);
create index if not exists idx_auction_transfers_proposer
  on public.auction_transfers (proposer_id);
create index if not exists idx_auction_transfers_recipient
  on public.auction_transfers (recipient_id);

comment on table public.auction_transfers is
  'Peer-to-peer player/cash transfers between auction participants.';

-- ---------------------------------------------------------------------------
-- 3. Helper: is a player locked in any active transfer?
-- ---------------------------------------------------------------------------
create or replace function public._player_in_active_transfer(
  p_auction_id bigint,
  p_player_id  text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.auction_transfers t
    where t.auction_id = p_auction_id
      and t.status not in ('completed', 'rejected', 'cancelled')
      and (p_player_id = any(t.proposer_player_ids)
           or p_player_id = any(t.recipient_player_ids))
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. propose_transfer
-- ---------------------------------------------------------------------------
create or replace function public.propose_transfer(
  p_auction_id          bigint,
  p_proposer_id         bigint,
  p_recipient_id        bigint,
  p_proposer_player_ids text[],
  p_proposer_cash       integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now          timestamptz := clock_timestamp();
  v_hard         timestamptz;
  v_pids         text[];
  v_pid          text;
  v_transfer_id  uuid;
begin
  v_pids := coalesce(p_proposer_player_ids, '{}');

  if p_proposer_cash < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_cash_amount');
  end if;

  if array_length(v_pids, 1) is null and p_proposer_cash = 0 then
    return jsonb_build_object('ok', false, 'error', 'must_offer_something');
  end if;

  if p_proposer_id = p_recipient_id then
    return jsonb_build_object('ok', false, 'error', 'cannot_transfer_to_self');
  end if;

  select a.hard_deadline_at into v_hard
  from public."Auctions" a where a.id = p_auction_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'auction_not_found');
  end if;

  if v_hard is not null and v_now >= v_hard then
    return jsonb_build_object('ok', false, 'error', 'transfer_deadline_passed');
  end if;

  if not exists (
    select 1 from public.auction_users where id = p_proposer_id and auction_id = p_auction_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'proposer_not_in_auction');
  end if;

  if not exists (
    select 1 from public.auction_users where id = p_recipient_id and auction_id = p_auction_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'recipient_not_in_auction');
  end if;

  foreach v_pid in array v_pids loop
    if not exists (
      select 1 from public.auction_teams
      where auction_id = p_auction_id
        and player_id::text = v_pid
        and auction_user_id = p_proposer_id
    ) then
      return jsonb_build_object('ok', false, 'error', 'player_not_owned_by_proposer');
    end if;

    if public._player_in_active_transfer(p_auction_id, v_pid) then
      return jsonb_build_object('ok', false, 'error', 'player_already_in_transfer');
    end if;
  end loop;

  insert into public.auction_transfers (
    auction_id, proposer_id, recipient_id,
    proposer_player_ids, proposer_cash,
    recipient_player_ids, recipient_cash,
    status
  ) values (
    p_auction_id, p_proposer_id, p_recipient_id,
    v_pids, p_proposer_cash,
    '{}', 0,
    'awaiting_response'
  )
  returning id into v_transfer_id;

  return jsonb_build_object('ok', true, 'transfer_id', v_transfer_id);
end;
$$;

grant execute on function public.propose_transfer(bigint,bigint,bigint,text[],integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. respond_to_transfer
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_transfer(
  p_transfer_id          uuid,
  p_auction_user_id      bigint,
  p_recipient_player_ids text[],
  p_recipient_cash       integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now              timestamptz := clock_timestamp();
  v_hard             timestamptz;
  v_transfer         record;
  v_proposer_budget  integer;
  v_recipient_budget integer;
  v_rpids            text[];
  v_pid              text;
begin
  v_rpids := coalesce(p_recipient_player_ids, '{}');

  if p_recipient_cash < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_cash_amount');
  end if;

  select * into v_transfer
  from public.auction_transfers where id = p_transfer_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'transfer_not_found');
  end if;

  if v_transfer.status <> 'awaiting_response' then
    return jsonb_build_object('ok', false, 'error', 'transfer_not_awaiting_response');
  end if;

  if v_transfer.recipient_id <> p_auction_user_id then
    return jsonb_build_object('ok', false, 'error', 'not_the_recipient');
  end if;

  if array_length(v_rpids, 1) is null and p_recipient_cash = 0 then
    return jsonb_build_object('ok', false, 'error', 'must_offer_something');
  end if;

  select a.hard_deadline_at into v_hard
  from public."Auctions" a where a.id = v_transfer.auction_id;

  if v_hard is not null and v_now >= v_hard then
    return jsonb_build_object('ok', false, 'error', 'transfer_deadline_passed');
  end if;

  foreach v_pid in array v_rpids loop
    if not exists (
      select 1 from public.auction_teams
      where auction_id = v_transfer.auction_id
        and player_id::text = v_pid
        and auction_user_id = p_auction_user_id
    ) then
      return jsonb_build_object('ok', false, 'error', 'player_not_owned_by_recipient');
    end if;

    if public._player_in_active_transfer(v_transfer.auction_id, v_pid) then
      return jsonb_build_object('ok', false, 'error', 'player_already_in_transfer');
    end if;
  end loop;

  -- Lock both budget rows before checking
  select active_budget into v_proposer_budget
  from public.auction_users where id = v_transfer.proposer_id
  for update;

  select active_budget into v_recipient_budget
  from public.auction_users where id = v_transfer.recipient_id
  for update;

  if v_transfer.proposer_cash > 0 and v_proposer_budget < v_transfer.proposer_cash then
    return jsonb_build_object('ok', false, 'error', 'proposer_insufficient_funds');
  end if;

  if p_recipient_cash > 0 and v_recipient_budget < p_recipient_cash then
    return jsonb_build_object('ok', false, 'error', 'recipient_insufficient_funds');
  end if;

  -- Hold cash for both parties
  if v_transfer.proposer_cash > 0 then
    update public.auction_users
    set active_budget = active_budget - v_transfer.proposer_cash
    where id = v_transfer.proposer_id;
  end if;

  if p_recipient_cash > 0 then
    update public.auction_users
    set active_budget = active_budget - p_recipient_cash
    where id = v_transfer.recipient_id;
  end if;

  update public.auction_transfers
  set recipient_player_ids = v_rpids,
      recipient_cash        = p_recipient_cash,
      status                = 'awaiting_confirmation',
      proposer_confirmed    = false,
      recipient_confirmed   = false
  where id = p_transfer_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.respond_to_transfer(uuid,bigint,text[],integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. _execute_transfer_internal (called by confirm + admin_approve)
-- ---------------------------------------------------------------------------
create or replace function public._execute_transfer_internal(p_transfer_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transfer              record;
  v_proposer_squad        integer;
  v_recipient_squad       integer;
  v_proposer_gk           integer;
  v_recipient_gk          integer;
  v_proposer_gks_leaving  integer;
  v_proposer_gks_gaining  integer;
  v_recipient_gks_leaving integer;
  v_recipient_gks_gaining integer;
  v_proposer_player_names text;
  v_recipient_player_names text;
  v_proposer_name         text;
  v_recipient_name        text;
  v_summary               text;
begin
  select * into v_transfer
  from public.auction_transfers where id = p_transfer_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'transfer_not_found');
  end if;

  -- Squad size checks (net effect for each party)
  select count(*) into v_proposer_squad
  from public.auction_teams
  where auction_id = v_transfer.auction_id and auction_user_id = v_transfer.proposer_id;

  select count(*) into v_recipient_squad
  from public.auction_teams
  where auction_id = v_transfer.auction_id and auction_user_id = v_transfer.recipient_id;

  -- GK counts per party
  select count(*) into v_proposer_gk
  from public.auction_teams t
  join public.players p on p.player_id::text = t.player_id::text
  where t.auction_id = v_transfer.auction_id
    and t.auction_user_id = v_transfer.proposer_id
    and lower(trim(p.position)) in ('gk', 'goalkeeper');

  select count(*) into v_recipient_gk
  from public.auction_teams t
  join public.players p on p.player_id::text = t.player_id::text
  where t.auction_id = v_transfer.auction_id
    and t.auction_user_id = v_transfer.recipient_id
    and lower(trim(p.position)) in ('gk', 'goalkeeper');

  -- GKs moving in each direction
  select count(*) into v_proposer_gks_leaving
  from public.players p
  where p.player_id::text = any(v_transfer.proposer_player_ids)
    and lower(trim(p.position)) in ('gk', 'goalkeeper');

  select count(*) into v_proposer_gks_gaining
  from public.players p
  where p.player_id::text = any(v_transfer.recipient_player_ids)
    and lower(trim(p.position)) in ('gk', 'goalkeeper');

  -- Recipient's direction is the mirror of proposer's
  v_recipient_gks_leaving := v_proposer_gks_gaining;
  v_recipient_gks_gaining := v_proposer_gks_leaving;

  -- Net squad size after transfer
  if (v_proposer_squad
      - coalesce(array_length(v_transfer.proposer_player_ids, 1), 0)
      + coalesce(array_length(v_transfer.recipient_player_ids, 1), 0)) > 18 then
    return jsonb_build_object('ok', false, 'error', 'proposer_squad_size_exceeded');
  end if;

  if (v_recipient_squad
      - coalesce(array_length(v_transfer.recipient_player_ids, 1), 0)
      + coalesce(array_length(v_transfer.proposer_player_ids, 1), 0)) > 18 then
    return jsonb_build_object('ok', false, 'error', 'recipient_squad_size_exceeded');
  end if;

  -- Net GK count after transfer
  if (v_proposer_gk - v_proposer_gks_leaving + v_proposer_gks_gaining) > 1 then
    return jsonb_build_object('ok', false, 'error', 'proposer_goalkeeper_limit_exceeded');
  end if;

  if (v_recipient_gk - v_recipient_gks_leaving + v_recipient_gks_gaining) > 1 then
    return jsonb_build_object('ok', false, 'error', 'recipient_goalkeeper_limit_exceeded');
  end if;

  -- Move proposer's players to recipient
  if array_length(v_transfer.proposer_player_ids, 1) > 0 then
    update public.auction_teams
    set auction_user_id = v_transfer.recipient_id
    where auction_id = v_transfer.auction_id
      and player_id::text = any(v_transfer.proposer_player_ids)
      and auction_user_id = v_transfer.proposer_id;
  end if;

  -- Move recipient's players to proposer
  if array_length(v_transfer.recipient_player_ids, 1) > 0 then
    update public.auction_teams
    set auction_user_id = v_transfer.proposer_id
    where auction_id = v_transfer.auction_id
      and player_id::text = any(v_transfer.recipient_player_ids)
      and auction_user_id = v_transfer.recipient_id;
  end if;

  -- Budget updates:
  -- Proposer: hold consumed (proposer_cash gone), receive recipient_cash
  update public.auction_users
  set budget_remaining = budget_remaining - v_transfer.proposer_cash + v_transfer.recipient_cash,
      active_budget    = active_budget    + v_transfer.recipient_cash
  where id = v_transfer.proposer_id;

  -- Recipient: hold consumed (recipient_cash gone), receive proposer_cash
  update public.auction_users
  set budget_remaining = budget_remaining - v_transfer.recipient_cash + v_transfer.proposer_cash,
      active_budget    = active_budget    + v_transfer.proposer_cash
  where id = v_transfer.recipient_id;

  -- Build plain-English summary
  select au.name into v_proposer_name
  from public.auction_users au where au.id = v_transfer.proposer_id;

  select au.name into v_recipient_name
  from public.auction_users au where au.id = v_transfer.recipient_id;

  select string_agg(p.player_name, ', ' order by p.player_name) into v_proposer_player_names
  from public.players p
  where p.player_id::text = any(v_transfer.proposer_player_ids);

  select string_agg(p.player_name, ', ' order by p.player_name) into v_recipient_player_names
  from public.players p
  where p.player_id::text = any(v_transfer.recipient_player_ids);

  v_summary := coalesce(v_proposer_name, 'Unknown') || ' sent ';
  if v_proposer_player_names is not null and v_transfer.proposer_cash > 0 then
    v_summary := v_summary || v_proposer_player_names || ' + £' || v_transfer.proposer_cash || 'm';
  elsif v_proposer_player_names is not null then
    v_summary := v_summary || v_proposer_player_names;
  else
    v_summary := v_summary || '£' || v_transfer.proposer_cash || 'm';
  end if;

  v_summary := v_summary || ' to ' || coalesce(v_recipient_name, 'Unknown') || ' in exchange for ';

  if v_recipient_player_names is not null and v_transfer.recipient_cash > 0 then
    v_summary := v_summary || v_recipient_player_names || ' + £' || v_transfer.recipient_cash || 'm';
  elsif v_recipient_player_names is not null then
    v_summary := v_summary || v_recipient_player_names;
  else
    v_summary := v_summary || '£' || v_transfer.recipient_cash || 'm';
  end if;

  update public.auction_transfers
  set status       = 'completed',
      completed_at = clock_timestamp(),
      admin_approved = case when status = 'pending_admin' then true else admin_approved end,
      summary      = v_summary
  where id = p_transfer_id;

  return jsonb_build_object('ok', true, 'summary', v_summary);
end;
$$;

grant execute on function public._execute_transfer_internal(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. confirm_transfer
-- ---------------------------------------------------------------------------
create or replace function public.confirm_transfer(
  p_transfer_id     uuid,
  p_auction_user_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transfer       record;
  v_is_proposer    boolean;
  v_is_recipient   boolean;
  v_require_admin  boolean;
  v_cash_only      boolean;
  v_both_confirmed boolean;
  v_exec_result    jsonb;
  v_new_proposer_confirmed boolean;
  v_new_recipient_confirmed boolean;
begin
  select * into v_transfer
  from public.auction_transfers where id = p_transfer_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'transfer_not_found');
  end if;

  if v_transfer.status <> 'awaiting_confirmation' then
    return jsonb_build_object('ok', false, 'error', 'transfer_not_awaiting_confirmation');
  end if;

  v_is_proposer  := (v_transfer.proposer_id  = p_auction_user_id);
  v_is_recipient := (v_transfer.recipient_id = p_auction_user_id);

  if not v_is_proposer and not v_is_recipient then
    return jsonb_build_object('ok', false, 'error', 'not_a_participant');
  end if;

  if v_is_proposer and v_transfer.proposer_confirmed then
    return jsonb_build_object('ok', false, 'error', 'already_confirmed');
  end if;

  if v_is_recipient and v_transfer.recipient_confirmed then
    return jsonb_build_object('ok', false, 'error', 'already_confirmed');
  end if;

  update public.auction_transfers
  set proposer_confirmed  = proposer_confirmed  or v_is_proposer,
      recipient_confirmed = recipient_confirmed or v_is_recipient
  where id = p_transfer_id
  returning proposer_confirmed, recipient_confirmed
  into v_new_proposer_confirmed, v_new_recipient_confirmed;

  v_both_confirmed := v_new_proposer_confirmed and v_new_recipient_confirmed;

  if not v_both_confirmed then
    return jsonb_build_object('ok', true, 'waiting_for_other_party', true);
  end if;

  -- Determine if admin approval is needed
  select a.transfers_require_admin_approval into v_require_admin
  from public."Auctions" a where a.id = v_transfer.auction_id;

  -- Cash-only transfers always require admin
  v_cash_only := (array_length(v_transfer.proposer_player_ids, 1) is null
                  and array_length(v_transfer.recipient_player_ids, 1) is null);

  if v_require_admin or v_cash_only then
    update public.auction_transfers set status = 'pending_admin' where id = p_transfer_id;
    return jsonb_build_object('ok', true, 'pending_admin', true);
  end if;

  v_exec_result := public._execute_transfer_internal(p_transfer_id);
  return v_exec_result;
end;
$$;

grant execute on function public.confirm_transfer(uuid, bigint)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. cancel_transfer (proposer only)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_transfer(
  p_transfer_id     uuid,
  p_auction_user_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transfer record;
begin
  select * into v_transfer
  from public.auction_transfers where id = p_transfer_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'transfer_not_found');
  end if;

  if v_transfer.status in ('completed', 'rejected', 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'transfer_already_closed');
  end if;

  if v_transfer.proposer_id <> p_auction_user_id then
    return jsonb_build_object('ok', false, 'error', 'only_proposer_can_cancel');
  end if;

  -- Release cash holds if they were set
  if v_transfer.status in ('awaiting_confirmation', 'pending_admin') then
    if v_transfer.proposer_cash > 0 then
      update public.auction_users
      set active_budget = active_budget + v_transfer.proposer_cash
      where id = v_transfer.proposer_id;
    end if;
    if v_transfer.recipient_cash > 0 then
      update public.auction_users
      set active_budget = active_budget + v_transfer.recipient_cash
      where id = v_transfer.recipient_id;
    end if;
  end if;

  update public.auction_transfers set status = 'cancelled' where id = p_transfer_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.cancel_transfer(uuid, bigint)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. reject_transfer (recipient only)
-- ---------------------------------------------------------------------------
create or replace function public.reject_transfer(
  p_transfer_id     uuid,
  p_auction_user_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transfer record;
begin
  select * into v_transfer
  from public.auction_transfers where id = p_transfer_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'transfer_not_found');
  end if;

  if v_transfer.status in ('completed', 'rejected', 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'transfer_already_closed');
  end if;

  if v_transfer.recipient_id <> p_auction_user_id then
    return jsonb_build_object('ok', false, 'error', 'only_recipient_can_reject');
  end if;

  -- Release cash holds if they were set
  if v_transfer.status in ('awaiting_confirmation', 'pending_admin') then
    if v_transfer.proposer_cash > 0 then
      update public.auction_users
      set active_budget = active_budget + v_transfer.proposer_cash
      where id = v_transfer.proposer_id;
    end if;
    if v_transfer.recipient_cash > 0 then
      update public.auction_users
      set active_budget = active_budget + v_transfer.recipient_cash
      where id = v_transfer.recipient_id;
    end if;
  end if;

  update public.auction_transfers set status = 'rejected' where id = p_transfer_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.reject_transfer(uuid, bigint)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. admin_approve_transfer
-- ---------------------------------------------------------------------------
create or replace function public.admin_approve_transfer(p_transfer_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transfer    record;
  v_exec_result jsonb;
begin
  select * into v_transfer
  from public.auction_transfers where id = p_transfer_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'transfer_not_found');
  end if;

  if v_transfer.status <> 'pending_admin' then
    return jsonb_build_object('ok', false, 'error', 'transfer_not_pending_admin');
  end if;

  v_exec_result := public._execute_transfer_internal(p_transfer_id);
  return v_exec_result;
end;
$$;

grant execute on function public.admin_approve_transfer(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 11. admin_reject_transfer
-- ---------------------------------------------------------------------------
create or replace function public.admin_reject_transfer(p_transfer_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transfer record;
begin
  select * into v_transfer
  from public.auction_transfers where id = p_transfer_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'transfer_not_found');
  end if;

  if v_transfer.status <> 'pending_admin' then
    return jsonb_build_object('ok', false, 'error', 'transfer_not_pending_admin');
  end if;

  if v_transfer.proposer_cash > 0 then
    update public.auction_users
    set active_budget = active_budget + v_transfer.proposer_cash
    where id = v_transfer.proposer_id;
  end if;

  if v_transfer.recipient_cash > 0 then
    update public.auction_users
    set active_budget = active_budget + v_transfer.recipient_cash
    where id = v_transfer.recipient_id;
  end if;

  update public.auction_transfers
  set status = 'rejected', admin_approved = false
  where id = p_transfer_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_reject_transfer(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- 12. void_expired_transfers: cancel all open transfers past the hard deadline
-- ---------------------------------------------------------------------------
create or replace function public.void_expired_transfers(p_auction_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_hard     timestamptz;
  v_transfer record;
  v_voided   integer := 0;
begin
  select a.hard_deadline_at into v_hard
  from public."Auctions" a where a.id = p_auction_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'auction_not_found');
  end if;

  if v_hard is null or clock_timestamp() < v_hard then
    return jsonb_build_object('ok', true, 'voided', 0);
  end if;

  for v_transfer in
    select * from public.auction_transfers
    where auction_id = p_auction_id
      and status not in ('completed', 'rejected', 'cancelled')
    for update
  loop
    if v_transfer.status in ('awaiting_confirmation', 'pending_admin') then
      if v_transfer.proposer_cash > 0 then
        update public.auction_users
        set active_budget = active_budget + v_transfer.proposer_cash
        where id = v_transfer.proposer_id;
      end if;
      if v_transfer.recipient_cash > 0 then
        update public.auction_users
        set active_budget = active_budget + v_transfer.recipient_cash
        where id = v_transfer.recipient_id;
      end if;
    end if;
    update public.auction_transfers set status = 'cancelled' where id = v_transfer.id;
    v_voided := v_voided + 1;
  end loop;

  return jsonb_build_object('ok', true, 'voided', v_voided);
end;
$$;

grant execute on function public.void_expired_transfers(bigint)
  to authenticated, service_role;
