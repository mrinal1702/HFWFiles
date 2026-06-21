-- Fantasy team display name per auction membership (nullable).
-- Safe to re-run.

alter table public.auction_users
  add column if not exists team_name text;

comment on column public.auction_users.team_name is
  'Optional fantasy team label for this auction. UI shows team_name when set, else name (participant).';
