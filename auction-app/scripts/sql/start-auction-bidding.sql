-- Start Bidding for a self-serve auction (HFW Self-Sufficiency, Oct 2026).
--
-- One irreversible, atomic step: lobby ('setup') → 'bidding'. Seeds the competition's
-- player pool as lots, copies the first gameweek's deadlines onto the auction, records
-- the first gameweek, turns bidding on and opens the transfer window.
--
-- The app picks the round (lib/auction-state/start-gameweek.ts); this function re-checks
-- it is still far enough away, so a stale page can't start an auction too late.
-- Idempotent: a second call on a started auction returns 'already_started' and changes nothing.

create or replace function public.start_auction_bidding(
  p_auction_id     bigint,
  p_admin          uuid,
  p_round_id       bigint,
  p_min_lead_hours integer default 120
) returns jsonb
language plpgsql
as $$
declare
  v_auction public."Auctions"%rowtype;
  v_round   public.competition_rounds%rowtype;
  v_seed    jsonb;
  v_lots    integer;
begin
  select * into v_auction from public."Auctions" where id = p_auction_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'auction_not_found'); end if;
  if v_auction.admin_user_id is distinct from p_admin then
    return jsonb_build_object('ok', false, 'error', 'not_admin');
  end if;
  if v_auction.status <> 'setup' then return jsonb_build_object('ok', false, 'error', 'already_started'); end if;

  select * into v_round from public.competition_rounds where id = p_round_id;
  if not found or v_round.competition_id is distinct from v_auction.competition_id then
    return jsonb_build_object('ok', false, 'error', 'round_not_in_competition');
  end if;
  if v_round.initiation_deadline_at is null or v_round.raise_deadline_at is null or v_round.hard_deadline_at is null then
    return jsonb_build_object('ok', false, 'error', 'round_not_scheduled');
  end if;
  if v_round.initiation_deadline_at < now() + make_interval(hours => p_min_lead_hours) then
    return jsonb_build_object('ok', false, 'error', 'round_too_close');
  end if;

  v_seed := public.seed_auction_lots_for_auction(p_auction_id);
  if coalesce((v_seed ->> 'ok')::boolean, false) is not true then
    raise exception 'seed_auction_lots_for_auction failed: %', v_seed;
  end if;
  v_lots := coalesce((v_seed ->> 'lots_total_for_auction')::integer, 0);
  if v_lots = 0 then raise exception 'no players in the competition pool for auction %', p_auction_id; end if;

  update public."Auctions" set
    status                 = 'bidding',
    is_active              = true,
    start_round_id         = v_round.id,
    bidding_started_at     = now(),
    bidding_deadline_mode  = 'global',
    rolling_game_week_id   = null,
    initiation_deadline_at = v_round.initiation_deadline_at,
    raise_deadline_at      = v_round.raise_deadline_at,
    hard_deadline_at       = v_round.hard_deadline_at,
    transfer_window_open   = true
  where id = p_auction_id;

  return jsonb_build_object(
    'ok', true,
    'auction_id', p_auction_id,
    'start_round_id', v_round.id,
    'round_slug', v_round.round_slug,
    'lots', v_lots
  );
end;
$$;

-- Service role only (security-lockdown.sql convention).
revoke all on function public.start_auction_bidding(bigint, uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.start_auction_bidding(bigint, uuid, bigint, integer) to service_role;
