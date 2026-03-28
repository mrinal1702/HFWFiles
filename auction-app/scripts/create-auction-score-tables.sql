-- Internal scoring tables (no timestamps), scoped by auction_id.
-- Run this once in Supabase SQL Editor.

create table if not exists public.auction_score_breakdown (
  id bigint generated always as identity primary key,
  auction_id bigint not null,
  auction_user_id bigint not null,
  player_id text not null,
  game_week_id bigint not null,
  score numeric not null default 0,
  unique (auction_id, auction_user_id, player_id, game_week_id)
);

create index if not exists idx_asb_auction_gw
  on public.auction_score_breakdown (auction_id, game_week_id);

create index if not exists idx_asb_auction_user_gw
  on public.auction_score_breakdown (auction_id, auction_user_id, game_week_id);

create table if not exists public.auction_leaderboard (
  auction_id bigint not null,
  auction_user_id bigint not null,
  game_week_id bigint not null,
  total_score numeric not null default 0,
  primary key (auction_id, auction_user_id, game_week_id)
);

create index if not exists idx_al_auction_gw_total
  on public.auction_leaderboard (auction_id, game_week_id, total_score desc);
