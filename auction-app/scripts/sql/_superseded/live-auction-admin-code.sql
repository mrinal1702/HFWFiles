-- Live auction: participant join_code (existing), admin_code, max_participants, admin grants.
-- Safe to re-run.

alter table public.live_auctions
  add column if not exists admin_code text;

alter table public.live_auctions
  add column if not exists max_participants integer not null default 16;

create unique index if not exists idx_live_auctions_admin_code_unique
  on public.live_auctions (admin_code)
  where admin_code is not null;

comment on column public.live_auctions.admin_code is
  'Secret 8-char code; redeem on /dashboard to unlock admin UI for this live auction.';

comment on column public.live_auctions.max_participants is
  'Cap on participant seats (role=participant with user_id set). Default 16.';

-- Admin access is separate from participant membership so commissioners can bid too.
create table if not exists public.live_auction_admin_grants (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references public.live_auctions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (auction_id, user_id)
);

create index if not exists idx_live_auction_admin_grants_user
  on public.live_auction_admin_grants (user_id);

comment on table public.live_auction_admin_grants is
  'Users who redeemed admin_code on the dashboard; grants /live-auction/{id}/admin access.';
