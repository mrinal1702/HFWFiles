-- Add join_code to live_auctions so participants can join without an account.
-- Safe to re-run.

alter table public.live_auctions
  add column if not exists join_code text;

-- Backfill existing rows with random 8-char codes
update public.live_auctions
set join_code = upper(substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 8))
where join_code is null;

create unique index if not exists idx_live_auctions_join_code_unique
  on public.live_auctions (join_code)
  where join_code is not null;

comment on column public.live_auctions.join_code is 'Public code to join this live auction; stored uppercase.';
