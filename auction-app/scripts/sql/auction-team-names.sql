-- Fantasy team display name per auction membership (nullable).
-- Safe to re-run.

alter table public.auction_users
  add column if not exists team_name text;

comment on column public.auction_users.team_name is
  'Fantasy team name for this auction (optional). Managers set it via Enter your team name for this auction in the app.';
