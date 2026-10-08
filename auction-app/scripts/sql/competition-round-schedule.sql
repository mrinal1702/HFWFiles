-- Round schedule on competition_rounds (HFW Self-Sufficiency, Oct 2026).
--
-- Lets the app know each gameweek's bidding deadlines and first kickoff, so a
-- self-created auction can work out which gameweek it starts at. Rows are
-- written by scripts/record-competition-schedule.mjs from
-- competitions/<tier>/<slug>/schedule.json — never edited by hand.
--
-- Additive only: four nullable columns + an ordering check. Existing rows
-- (EPL MW1, CL 2025/26) keep null schedules. Idempotent.

alter table public.competition_rounds
  add column if not exists initiation_deadline_at timestamptz,
  add column if not exists raise_deadline_at      timestamptz,
  add column if not exists hard_deadline_at       timestamptz,
  add column if not exists first_kickoff_at       timestamptz;

-- initiation <= raise <= hard <= first kickoff (whenever the values are present).
alter table public.competition_rounds
  drop constraint if exists competition_rounds_schedule_order;
alter table public.competition_rounds
  add constraint competition_rounds_schedule_order check (
        (initiation_deadline_at is null or raise_deadline_at is null or initiation_deadline_at <= raise_deadline_at)
    and (raise_deadline_at      is null or hard_deadline_at  is null or raise_deadline_at      <= hard_deadline_at)
    and (hard_deadline_at       is null or first_kickoff_at  is null or hard_deadline_at       <= first_kickoff_at)
  );

-- Upcoming-round lookups ("next rounds for competition X after now").
create index if not exists idx_competition_rounds_schedule
  on public.competition_rounds (competition_id, initiation_deadline_at);
