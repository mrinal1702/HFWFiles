-- Widen players table id columns to accommodate World Cup team IDs
-- and synthetic GK player IDs (90_000_000 + team_id).
--
-- smallint max = 32,767  →  too small for team_id 287981 (Curaçao)
--                            and synthetic player_ids like 90287981
-- integer   max = 2,147,483,647  →  sufficient for both
--
-- Run this once in the Supabase SQL Editor before importing the WC player list.

alter table public.players
  alter column player_id type integer using player_id::integer,
  alter column team_id   type integer using team_id::integer;
