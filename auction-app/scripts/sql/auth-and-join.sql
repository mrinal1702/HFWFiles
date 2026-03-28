-- Auth profiles, auction join codes, and membership link (auth user ↔ auction_users).
-- Run in Supabase SQL Editor after: auction-bidding.sql
-- Before: reset-testing-environment.sql / testing-auction-helpers.sql (those inserts expect join_code + max_participants columns).
-- Supabase Auth: disable "Confirm email" for frictionless dev if desired (Authentication → Providers → Email).

-- ---------------------------------------------------------------------------
-- 1) Profiles (global display name, one row per auth user)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'App profile; display_name is global across auctions.';

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Insert on signup (display_name from raw_user_meta_data or email local part)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2) Auctions: join code + capacity (12 default)
-- ---------------------------------------------------------------------------
alter table public."Auctions"
  add column if not exists join_code text;

alter table public."Auctions"
  add column if not exists max_participants integer not null default 12;

-- Backfill codes for existing rows (8-char hex from random md5)
update public."Auctions" a
set join_code = upper(substr(md5(random()::text || a.id::text || clock_timestamp()::text), 1, 8))
where join_code is null;

-- Ensure uniqueness (nullable-safe: only non-null values must be unique)
create unique index if not exists idx_auctions_join_code_unique
  on public."Auctions" (join_code)
  where join_code is not null;

-- After backfill, require join_code for new inserts (optional strict step):
-- alter table public."Auctions" alter column join_code set not null;

comment on column public."Auctions".join_code is 'Public code to join this auction; store/compare uppercase.';
comment on column public."Auctions".max_participants is 'Hard cap on auction_users rows for this auction (default 12).';

-- ---------------------------------------------------------------------------
-- 3) auction_users: link to Supabase auth user
-- ---------------------------------------------------------------------------
alter table public.auction_users
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create unique index if not exists auction_users_auction_auth_unique
  on public.auction_users (auction_id, user_id)
  where user_id is not null;

comment on column public.auction_users.user_id is 'Supabase auth user; null = legacy / test row without login.';
