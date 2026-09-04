-- Online auction commissioner: one admin per auction (auth user UUID).
-- Run once in Supabase SQL Editor before using the admin lab / admin UI.

alter table public."Auctions"
  add column if not exists admin_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists idx_auctions_admin_user_id_unique
  on public."Auctions" (admin_user_id)
  where admin_user_id is not null;

comment on column public."Auctions".admin_user_id is
  'Single commissioner for this auction (auth.users id). Null = no admin assigned.';
