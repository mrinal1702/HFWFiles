-- Online auction commissioner: one admin per auction (auth user UUID).
-- Run once in Supabase SQL Editor before using the admin lab / admin UI.
--
-- "One admin per auction" is guaranteed by this being a single column per
-- Auctions row. A single person MAY admin multiple auctions, so admin_user_id
-- is intentionally NOT unique.

alter table public."Auctions"
  add column if not exists admin_user_id uuid references auth.users (id) on delete set null;

-- Drop the old uniqueness constraint if a previous version created it
-- (it wrongly restricted a person to adminning only one auction).
drop index if exists idx_auctions_admin_user_id_unique;

-- Non-unique lookup index: supports "which auctions does this user admin?"
-- (used by the dashboard "Admin - <Auction>" links).
create index if not exists idx_auctions_admin_user_id
  on public."Auctions" (admin_user_id)
  where admin_user_id is not null;

comment on column public."Auctions".admin_user_id is
  'Commissioner for this auction (auth.users id). Null = no admin. A user may admin many auctions.';
