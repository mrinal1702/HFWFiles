-- reset_testing_environment: wipe test auction state, recreate game week + auction, reset user budgets.
-- Keeps public.players and auction_users rows (same managers; budgets -> 350).
-- Run in Supabase SQL Editor after auction-bidding.sql (or merge into your migration set).
--
-- If DELETE FROM player_scores fails (table name differs), edit the block below or run:
--   DELETE FROM public."Player_Scores";

create or replace function public.reset_testing_environment()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_auction_id bigint;
  v_gw_id bigint := 1;
  v_deadline timestamptz := (timestamp '2026-03-29 17:00:00' at time zone 'Europe/Dublin');
  v_users_updated integer := 0;
  v_scores_deleted text := 'skipped';
  seq_name text;
begin
  -- 1) Clear auction facts (TRUNCATE avoids Supabase "DELETE requires a WHERE clause", SQLSTATE 21000).
  truncate table
    public.auction_score_breakdown,
    public.auction_leaderboard,
    public.auction_teams,
    public.auction_lots,
    public.auction_bids
  cascade;

  -- 2) Player scores (snake_case or PascalCase table name)
  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname = 'player_scores'
  ) then
    truncate table public.player_scores cascade;
    v_scores_deleted := 'player_scores';
  elsif exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname = 'Player_Scores'
  ) then
    execute 'truncate table public."Player_Scores" cascade';
    v_scores_deleted := 'Player_Scores';
  else
    v_scores_deleted := 'none_found';
  end if;

  -- 3) Game weeks (TRUNCATE only; scores already cleared above)
  truncate table public."Game_Weeks" cascade;

  insert into public."Game_Weeks" (id, "GW_Name", "Is_Active")
  values (v_gw_id, 'UEFA CL RO16 Leg 1', true);

  seq_name := pg_get_serial_sequence('public."Game_Weeks"', 'id');
  if seq_name is not null then
    perform setval(seq_name, (select coalesce(max(id), 1) from public."Game_Weeks"));
  end if;

  -- 4) New auction id (after this run, only this row should remain)
  select coalesce(max(id), 0) + 1 into v_new_auction_id from public."Auctions";

  insert into public."Auctions" (id, name, is_active, hard_deadline_at, join_code, max_participants)
  values (
    v_new_auction_id,
    'bidding_test_auction',
    true,
    v_deadline,
    upper(substr(md5(random()::text || clock_timestamp()::text || v_new_auction_id::text), 1, 8)),
    12
  );

  -- Supabase can reject UPDATE with no WHERE (SQLSTATE 21000); use a tautology that still hits every row.
  update public.auction_users
  set
    auction_id = v_new_auction_id,
    budget_remaining = 350,
    active_budget = 350
  where id is not null
     or id is null;

  get diagnostics v_users_updated = row_count;

  delete from public."Auctions"
  where id <> v_new_auction_id;

  seq_name := pg_get_serial_sequence('public."Auctions"', 'id');
  if seq_name is not null then
    perform setval(seq_name, (select coalesce(max(id), 1) from public."Auctions"));
  end if;

  return jsonb_build_object(
    'ok', true,
    'auction_id', v_new_auction_id,
    'auction_name', 'bidding_test_auction',
    'game_week_id', v_gw_id,
    'game_week_name', 'UEFA CL RO16 Leg 1',
    'hard_deadline_at', v_deadline,
    'auction_users_updated', v_users_updated,
    'player_scores_table', v_scores_deleted
  );
end;
$$;

comment on function public.reset_testing_environment() is
  'Test reset: clears scores, teams, bids, lots, leaderboards; one active GW; new bidding_test_auction; all auction_users -> 350 budget.';

grant execute on function public.reset_testing_environment() to authenticated;
grant execute on function public.reset_testing_environment() to service_role;
