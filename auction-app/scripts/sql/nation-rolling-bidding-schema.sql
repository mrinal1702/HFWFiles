-- Nation-rolling bidding (per-nation raise + hard deadlines).
-- Safe to re-run (IF NOT EXISTS / additive columns).
-- Does NOT change existing auctions until bidding_deadline_mode = 'nation_rolling'.
--
-- Run BEFORE: nation-rolling-bidding-rpc.sql (and any nation_rolling auction open scripts)

-- ---------------------------------------------------------------------------
-- 1) Auction mode columns
-- ---------------------------------------------------------------------------

alter table public."Auctions"
  add column if not exists bidding_deadline_mode text not null default 'global';

alter table public."Auctions"
  drop constraint if exists auctions_bidding_deadline_mode_check;

alter table public."Auctions"
  add constraint auctions_bidding_deadline_mode_check
  check (bidding_deadline_mode in ('global', 'nation_rolling'));

comment on column public."Auctions".bidding_deadline_mode is
  'global = single auction hard deadline (default). nation_rolling = per-nation raise/hard from auction_nation_deadlines; hard_deadline_at = final window end.';

alter table public."Auctions"
  add column if not exists rolling_game_week_id bigint;

comment on column public."Auctions".rolling_game_week_id is
  'For nation_rolling: gameweek_squads.game_week_id for incremental nation locks. Does not use Game_Weeks.Is_Active.';

-- ---------------------------------------------------------------------------
-- 2) Per-nation schedule (one row per nation in the knockout round)
-- ---------------------------------------------------------------------------

create table if not exists public.auction_nation_deadlines (
  auction_id         bigint      not null references public."Auctions"(id) on delete cascade,
  team_name          text        not null,
  kickoff_at         timestamptz not null,
  raise_deadline_at  timestamptz not null,
  hard_deadline_at   timestamptz not null,
  locked_at          timestamptz,
  primary key (auction_id, team_name),
  check (raise_deadline_at < hard_deadline_at),
  check (hard_deadline_at <= kickoff_at)
);

create index if not exists idx_auction_nation_deadlines_auction_hard
  on public.auction_nation_deadlines (auction_id, hard_deadline_at);

comment on table public.auction_nation_deadlines is
  'Knockout-round bidding: raise (+5) and hard stop per nation (players.team_name). locked_at set when lots finalized + squads snapshotted for that nation.';
