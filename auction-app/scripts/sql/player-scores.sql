-- Auction-agnostic player scores by gameweek (FotMob player_id).
-- Run once in Supabase SQL Editor.
--
-- Stores one final score per player per gameweek. Safe to re-run as matches
-- are scored or scores are amended — use upsert_player_scores() below.

-- Existing table: public."Player_Scores" (player_id, game_week_id, "Score")
-- Enforce one row per player per GW (required for ON CONFLICT upserts).
alter table public."Player_Scores"
  drop constraint if exists player_scores_player_gw_unique;

alter table public."Player_Scores"
  add constraint player_scores_player_gw_unique unique (player_id, game_week_id);

create index if not exists idx_player_scores_game_week
  on public."Player_Scores" (game_week_id);

create index if not exists idx_player_scores_player
  on public."Player_Scores" (player_id);

-- Lowercase view for scripts that expect player_scores.score
create or replace view public.player_scores as
select
  id,
  player_id,
  game_week_id,
  "Score" as score
from public."Player_Scores";

-- Bulk upsert: pass a JSON array of { "player_id": <bigint>, "score": <number> }.
-- Returns { game_week_id, upserted }.
create or replace function public.upsert_player_scores(
  p_game_week_id bigint,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upserted integer;
begin
  if p_game_week_id is null then
    raise exception 'p_game_week_id is required';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  insert into public."Player_Scores" (player_id, game_week_id, "Score")
  select
    (r->>'player_id')::bigint,
    p_game_week_id,
    (r->>'score')::numeric
  from jsonb_array_elements(p_rows) as r
  where (r->>'player_id') is not null
    and (r->>'score') is not null
  on conflict (player_id, game_week_id)
  do update set "Score" = excluded."Score";

  get diagnostics v_upserted = row_count;

  return jsonb_build_object(
    'game_week_id', p_game_week_id,
    'upserted', v_upserted
  );
end;
$$;

grant execute on function public.upsert_player_scores(bigint, jsonb) to service_role;

-- ─── Example: upsert one match (edit scores / add players as needed) ─────────
-- select public.upsert_player_scores(
--   1,
--   '[
--     {"player_id": 828159, "score": 37},
--     {"player_id": 720560, "score": 56}
--   ]'::jsonb
-- );

-- ─── Example: check GW1 scores for a player ──────────────────────────────────
-- select * from public."Player_Scores" where game_week_id = 1 and player_id = 828159;
