-- Participant relegation (manager elimination by standings).
-- Run once in Supabase SQL Editor before apply-participant-relegations.mjs or apply SQL.

alter table public.auction_users
  add column if not exists is_relegated boolean not null default false;

alter table public.auction_users
  add column if not exists relegated_at timestamptz;

comment on column public.auction_users.is_relegated is
  'True when manager was relegated by standings — view-only, no squad or bidding.';

create table if not exists public.auction_participant_relegations (
  id                  bigserial primary key,
  auction_id          bigint      not null references public."Auctions"(id) on delete cascade,
  auction_user_id     bigint      not null references public.auction_users(id) on delete cascade,
  season_total_points int         not null default 0,
  rank_at_relegation  int         not null default 0,
  created_at          timestamptz not null default now(),
  unique (auction_id, auction_user_id)
);

create index if not exists idx_participant_relegations_auction
  on public.auction_participant_relegations (auction_id);

-- Mark relegated managers (RO32 cut — cumulative standings after GW4).
update public.auction_users
set
  is_relegated = true,
  relegated_at = coalesce(relegated_at, now()),
  budget_remaining = 0,
  active_budget = 0
where id in (41, 40, 45, 44, 63, 54, 51);

insert into public.auction_participant_relegations (auction_id, auction_user_id, season_total_points, rank_at_relegation)
values
  (5, 41, 1511, 13),
  (5, 40, 1430, 14),
  (5, 45, 1399, 15),
  (5, 44, 1357, 16),
  (6, 63, 1523, 13),
  (6, 54, 1440, 14),
  (6, 51, 1405, 15)
on conflict (auction_id, auction_user_id) do nothing;
