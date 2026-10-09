-- Self-serve auction creation (HFW Self-Sufficiency, Oct 2026).
--
-- Adds the auction lifecycle state + creation metadata to "Auctions", makes
-- auction names unique forever, and adds create_self_serve_auction() which
-- creates an auction (and optionally the creator's seat) atomically.
--
-- Existing auctions are untouched apart from status = 'bidding' (the column
-- default). Idempotent — safe to re-run.

-- ── 1. Lifecycle + metadata columns ──────────────────────────────────────────
alter table public."Auctions"
  add column if not exists status text not null default 'bidding',
  add column if not exists start_round_id bigint references public.competition_rounds(id),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz,
  add column if not exists bidding_started_at timestamptz;

alter table public."Auctions" drop constraint if exists auctions_status_check;
alter table public."Auctions"
  add constraint auctions_status_check check (status in ('setup', 'bidding'));

comment on column public."Auctions".status is
  'setup = lobby (created, bidding not started); bidding = Start Bidding pressed (all pre-self-serve auctions).';
comment on column public."Auctions".start_round_id is
  'First scoring gameweek (competition_rounds.id), fixed when the commissioner presses Start Bidding.';

-- ── 2. Names unique forever (case- and whitespace-insensitive) ───────────────
create unique index if not exists idx_auctions_name_key
  on public."Auctions" (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

-- ── 3. Auction id sequence was behind hand-inserted ids (last_value 11, max 13) ─
select setval(
  pg_get_serial_sequence('public."Auctions"', 'id'),
  greatest((select coalesce(max(id), 1) from public."Auctions"),
           (select last_value from public."Auctions_id_seq"))
);

-- ── 4. create_self_serve_auction ─────────────────────────────────────────────
create or replace function public.create_self_serve_auction(
  p_creator          uuid,
  p_name             text,
  p_play             boolean,
  p_competition_id   bigint,
  p_seat_name        text,
  p_starting_budget  integer default 350,
  p_max_participants integer default 16,
  p_max_open_lobbies integer default 3
) returns jsonb
language plpgsql
as $$
declare
  v_name      text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_key       text := lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
  v_alphabet  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no 0/O/1/I
  v_code      text;
  v_auction   bigint;
  v_attempt   integer := 0;
begin
  if p_creator is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if length(v_name) < 3 or length(v_name) > 60 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;
  if not exists (select 1 from public.competitions where id = p_competition_id and status <> 'archived') then
    return jsonb_build_object('ok', false, 'error', 'competition_unavailable');
  end if;
  if (select count(*) from public."Auctions" where created_by = p_creator and status = 'setup') >= p_max_open_lobbies then
    return jsonb_build_object('ok', false, 'error', 'too_many_open_lobbies');
  end if;
  -- Live-auction names are reserved too (the unique index covers online auctions).
  if exists (select 1 from public.live_auctions where lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = v_key) then
    return jsonb_build_object('ok', false, 'error', 'name_taken');
  end if;

  -- 8-character join code, unique across online + live auction codes.
  loop
    v_attempt := v_attempt + 1;
    v_code := (
      select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      from generate_series(1, 8)
    );
    exit when not exists (select 1 from public."Auctions" where join_code = v_code)
          and not exists (select 1 from public.live_auctions where join_code = v_code or admin_code = v_code);
    if v_attempt >= 20 then return jsonb_build_object('ok', false, 'error', 'join_code_exhausted'); end if;
  end loop;

  begin
    insert into public."Auctions" (
      name, status, is_active, competition_id, admin_user_id, join_code, max_participants,
      created_by, created_at
    ) values (
      v_name, 'setup', false, p_competition_id, p_creator, v_code, p_max_participants,
      p_creator, now()
    ) returning id into v_auction;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'name_taken');
  end;

  if p_play then
    insert into public.auction_users (auction_id, name, budget_remaining, active_budget, user_id)
    values (v_auction, coalesce(nullif(btrim(p_seat_name), ''), 'Player'), p_starting_budget, p_starting_budget, p_creator);
  end if;

  return jsonb_build_object('ok', true, 'auction_id', v_auction, 'join_code', v_code, 'name', v_name);
end;
$$;

-- Service role only (security-lockdown.sql convention).
revoke all on function public.create_self_serve_auction(uuid, text, boolean, bigint, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.create_self_serve_auction(uuid, text, boolean, bigint, text, integer, integer, integer) to service_role;
