-- Auction visibility + spectators (Project Socialize V-1 / V-2, Nov 2026).
-- Apply by hand in the Supabase SQL Editor. Additive only: safe to run while auctions are live.
--
-- 1. "Auctions".visibility — who may open an auction without a seat.
--      private (default) = participants, the auction's admin and listed spectators only
--      public            = anyone (guest access is a later step; today it still needs a login)
--    Every existing auction becomes 'private', so nothing changes for anyone.
--    A middle level (e.g. signed-in / friends, open decision Q1) can be added later by widening
--    the check constraint — no data migration needed.
--
-- 2. auction_spectators — explicit view-only grants on a private auction. Replaces the hard-coded
--    map that lived in lib/auction-spectators.ts (auction 11 → 2 users). Rows are copied below.
--
-- The app reads both only through lib/auction-access.ts (service role). RLS on, no policies.
--
-- Undo:
--   drop table if exists public.auction_spectators;
--   alter table public."Auctions" drop constraint if exists auctions_visibility_check;
--   alter table public."Auctions" drop column if exists visibility;

begin;

alter table public."Auctions"
  add column if not exists visibility text not null default 'private';

alter table public."Auctions" drop constraint if exists auctions_visibility_check;
alter table public."Auctions"
  add constraint auctions_visibility_check check (visibility in ('private', 'public'));

create table if not exists public.auction_spectators (
  auction_id  bigint      not null references public."Auctions"(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (auction_id, user_id)
);

create index if not exists idx_auction_spectators_user on public.auction_spectators (user_id);

alter table public.auction_spectators enable row level security;
revoke all on public.auction_spectators from anon, authenticated;
grant all on public.auction_spectators to service_role;

-- Carry over the spectators from lib/auction-spectators.ts (auction 11, UCL 2026/27).
insert into public.auction_spectators (auction_id, user_id) values
  (11, 'b23b15cc-e103-4248-ba55-d1bd6d0608c3'),
  (11, '4cca3de6-8b82-4c6d-94ad-df1396f3290a')
on conflict do nothing;

commit;

-- Checks (expect: every auction 'private'; 2 spectator rows on auction 11).
select visibility, count(*) from public."Auctions" group by visibility;
select auction_id, user_id from public.auction_spectators order by auction_id, user_id;
