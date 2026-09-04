-- One-time setup: audit table for elimination refunds (idempotent re-runs).
-- Run once in Supabase SQL Editor before first elimination batch.

create table if not exists public.auction_elimination_refunds (
  id              bigserial primary key,
  auction_id      bigint      not null references public."Auctions"(id) on delete cascade,
  auction_user_id bigint      not null references auction_users(id) on delete cascade,
  player_id       text        not null,
  team_name       text        not null,
  purchase_price  int         not null,
  refund_amount   int         not null,
  created_at      timestamptz not null default now(),
  unique (auction_id, player_id)
);

create index if not exists idx_elimination_refunds_auction
  on public.auction_elimination_refunds (auction_id);
