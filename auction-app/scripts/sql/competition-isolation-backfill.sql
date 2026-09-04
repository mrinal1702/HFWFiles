-- ════════════════════════════════════════════════════════════════════════════
-- Competition & Auction Data Isolation — BACKFILL + constraint
-- Context: docs/context/COMPETITION_AUCTION_DATA_ISOLATION.md
--
-- Prerequisite: run competition-isolation-schema.sql FIRST (creates tables,
--               columns, seeds competitions/rounds/matches).
--
-- What this does:
--   1. Attaches existing auctions to their competition.
--   2. Populates competition_players for EPL from the global players pool.
--   3. Bridges EPL Matchweek 1 to its current (active) legacy game_week_id.
--   4. Backfills competition_round_id on existing Player_Scores rows.
--   5. Backfills competition_match_id + fotmob_match_id via team match.
--   6. Verifies, then adds the (competition_round_id, player_id) unique key.
--
-- Run top-to-bottom in the Supabase SQL Editor. Steps 0 and the verify blocks
-- are read-only checks — inspect their output before moving on.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── STEP 0 · Diagnostics (read-only) ───────────────────────────────────────
-- 0a. How many score rows sit under each game_week_id today?
select game_week_id, count(*) as rows
from public."Player_Scores"
group by game_week_id
order by game_week_id;

-- 0b. Which game week is currently active? (existing EPL MW1 scores live here)
select id, "Is_Active" from public."Game_Weeks" where "Is_Active" = true;

-- 0c. What are your auction IDs and names? Use this to confirm the EPL auction.
select id, name, competition_id from public."Auctions" order by id;

-- ─── STEP 1 · Attach auctions to competitions ───────────────────────────────
-- World Cup 2026 (confirmed).
update public."Auctions" set competition_id = 1 where id in (5, 6, 7);

-- EPL 2026/27 — active auction id is 9 (auction 8 is a test placeholder, skip it).
update public."Auctions" set competition_id = 2 where id in (9);

-- ─── STEP 2 · Populate competition_players for EPL from the global pool ──────
-- The current public.players table is the active EPL pool.
insert into public.competition_players
  (competition_id, player_id, player_name, position, team_id, team_name)
select
  2,
  p.player_id::bigint,
  p.player_name,
  p.position,
  nullif(p.team_id, '')::bigint,
  p.team_name
from public.players p
where p.player_id is not null
on conflict (competition_id, player_id) do update
  set player_name = excluded.player_name,
      position    = excluded.position,
      team_id     = excluded.team_id,
      team_name   = excluded.team_name;

-- ─── STEP 3 · Bridge EPL MW1 to the current active game_week_id ─────────────
-- Existing EPL MW1 scores were published under the single active game week.
-- Point competition_rounds.mw01 at that id so the backfill join can find them.
update public.competition_rounds
set legacy_game_week_id = (
  select id from public."Game_Weeks" where "Is_Active" = true limit 1
)
where id = 101;  -- EPL 2026/27 · mw01

-- ─── STEP 4 · Backfill competition_round_id on existing scores ──────────────
update public."Player_Scores" ps
set competition_round_id = cr.id
from public.competition_rounds cr
where cr.legacy_game_week_id = ps.game_week_id
  and ps.competition_round_id is null;

-- ─── STEP 5 · Backfill match ID + competition_match_id (team match) ─────────
-- A player's match in a round is the fixture whose home OR away team is theirs
-- (one fixture per team per round). Requires competition_players (STEP 2).
update public."Player_Scores" ps
set competition_match_id = cm.id,
    fotmob_match_id      = cm.fotmob_match_id
from public.competition_rounds cr
join public.competition_players cp on cp.competition_id = cr.competition_id
join public.competition_matches cm
  on cm.round_id = cr.id
 and (cm.home_team = cp.team_name or cm.away_team = cp.team_name)
where ps.competition_round_id = cr.id
  and cp.player_id = ps.player_id
  and ps.competition_match_id is null;

-- ─── STEP 6 · Verify (read-only) ────────────────────────────────────────────
-- 6a. Any scored rows we could not map to a round? (should be 0 for EPL)
select count(*) as unmapped_round
from public."Player_Scores"
where competition_round_id is null;

-- 6b. Any EPL rows still missing a match tag? Investigate team-name mismatches.
select ps.player_id, ps.game_week_id
from public."Player_Scores" ps
where ps.competition_round_id = 101
  and ps.competition_match_id is null;

-- 6c. Sanity: one match per (round, player)?
select competition_round_id, player_id, count(*)
from public."Player_Scores"
where competition_round_id is not null
group by competition_round_id, player_id
having count(*) > 1;

-- ─── STEP 7 · Add the competition-safe unique key ───────────────────────────
-- Run only after STEP 6a returns 0 (all in-scope rows have a round).
-- NULL competition_round_id rows are tolerated (Postgres treats NULLs as
-- distinct) but every active competition row should be backfilled first.
alter table public."Player_Scores"
  drop constraint if exists player_scores_round_player_unique;

alter table public."Player_Scores"
  add constraint player_scores_round_player_unique
  unique (competition_round_id, player_id);

-- Optional: keep the legacy (player_id, game_week_id) key too — it stays valid
-- as long as competitions use the reserved non-overlapping game_week_id ranges
-- (World Cup 1–99, EPL 100–199, UEFA CL 200–299). If you later migrate EPL MW1
-- rows onto the reserved id 100, update competition_rounds.legacy_game_week_id
-- to 100 as well so the two keys stay consistent.
