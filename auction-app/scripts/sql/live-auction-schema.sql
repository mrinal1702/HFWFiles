-- Live Auction Module — Schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: all statements use IF NOT EXISTS.

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists live_auctions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  status          text not null default 'setup'
                    check (status in ('setup', 'live', 'paused', 'completed')),
  starting_budget integer not null default 350,
  squad_size      integer not null default 18,
  min_bid         integer not null default 5,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

-- Participants in a live auction.
-- role = 'admin' means this person is the auctioneer — only admins can record sales.
-- user_id is nullable so an admin can pre-create placeholder seats before sign-up.
create table if not exists live_auction_participants (
  id              uuid primary key default gen_random_uuid(),
  auction_id      uuid not null references live_auctions(id) on delete cascade,
  user_id         uuid references auth.users(id),
  display_name    text not null,
  role            text not null default 'participant'
                    check (role in ('participant', 'admin')),
  created_at      timestamptz not null default now()
);

-- Unique participant per auction — only enforced when user_id is not null
-- so multiple placeholder (null) rows are allowed.
create unique index if not exists live_auction_participants_auction_user_unique
  on live_auction_participants (auction_id, user_id)
  where user_id is not null;

-- The player pool for a given auction.
-- fotmob_player_id is the FotMob player ID (matches players.player_id in the main pipeline).
-- Players are seeded from the existing players table via seed-live-auction-players.mjs.
create table if not exists live_auction_players (
  id               uuid primary key default gen_random_uuid(),
  auction_id       uuid not null references live_auctions(id) on delete cascade,
  fotmob_player_id text not null,
  player_name      text not null,
  team_name        text,
  nation           text,
  position         text,
  status           text not null default 'available'
                     check (status in ('available', 'sold', 'unsold')),
  created_at       timestamptz not null default now(),
  unique (auction_id, fotmob_player_id)
);

-- Completed sales. This is the sole source of truth.
-- Squads and budgets are always derived from non-voided rows — never stored separately.
create table if not exists live_auction_sales (
  id               uuid primary key default gen_random_uuid(),
  auction_id       uuid not null references live_auctions(id) on delete cascade,
  player_id        uuid not null references live_auction_players(id),
  participant_id   uuid not null references live_auction_participants(id),
  price            integer not null check (price > 0),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  is_voided        boolean not null default false,
  void_reason      text
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_las_auction_id
  on live_auction_sales (auction_id);

create index if not exists idx_las_participant_id
  on live_auction_sales (participant_id);

create index if not exists idx_las_auction_participant
  on live_auction_sales (auction_id, participant_id) where is_voided = false;

create index if not exists idx_lap_auction_id
  on live_auction_players (auction_id);

create index if not exists idx_lapart_auction_id
  on live_auction_participants (auction_id);

create index if not exists idx_lapart_user_id
  on live_auction_participants (user_id);
