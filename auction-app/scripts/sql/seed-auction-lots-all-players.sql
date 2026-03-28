-- Seed auction_lots: one row per player in public.players for a given auction.
-- Safe to re-run: ON CONFLICT DO NOTHING skips existing (auction_id, player_id).
--
-- Option A — Supabase SQL Editor (edit v_auction_id if needed):
-- ---------------------------------------------------------------------------

do $$
declare
  v_auction_id bigint := 2; -- match AUCTION_LAB_AUCTION_ID / your bidding_test_auction id
begin
  insert into public.auction_lots (auction_id, player_id, status)
  select
    v_auction_id,
    trim(pl.player_id::text),
    'uninitiated'
  from public.players pl
  where trim(coalesce(pl.player_id::text, '')) <> ''
  on conflict (auction_id, player_id) do nothing;
end $$;

-- Optional: check count
-- select count(*) as lots_for_auction from public.auction_lots where auction_id = 2;

-- ---------------------------------------------------------------------------
-- Option B — RPC for npm run seed:auction-lots (same logic)
-- ---------------------------------------------------------------------------

create or replace function public.seed_auction_lots_for_auction(p_auction_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_auction_id is null or p_auction_id < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_auction_id');
  end if;

  insert into public.auction_lots (auction_id, player_id, status)
  select
    p_auction_id,
    trim(pl.player_id::text),
    'uninitiated'
  from public.players pl
  where trim(coalesce(pl.player_id::text, '')) <> ''
  on conflict (auction_id, player_id) do nothing;

  select count(*)::integer into v_count
  from public.auction_lots al
  where al.auction_id = p_auction_id;

  return jsonb_build_object(
    'ok', true,
    'auction_id', p_auction_id,
    'lots_total_for_auction', v_count
  );
end;
$$;

comment on function public.seed_auction_lots_for_auction(bigint) is
  'Inserts uninitiated auction_lots for every public.players row; idempotent.';

grant execute on function public.seed_auction_lots_for_auction(bigint) to authenticated;
grant execute on function public.seed_auction_lots_for_auction(bigint) to service_role;
