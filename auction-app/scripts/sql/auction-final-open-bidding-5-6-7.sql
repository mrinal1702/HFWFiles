-- Open Finals (GW8) bidding for auctions 5, 6, 7 (nation_rolling mode).
-- Safe to re-run (idempotent: nation deadlines are delete + re-insert).
--
-- Prerequisites:
--   1. GW7 Semi Finals squads locked (auction-gw7-lock-all.sql / lock-gameweek-squads.mjs)
--   2. SF participant relegation (3rd/4th) applied
--   3. France + England elimination refunds applied
--
-- Equivalent CLI (preferred):
--   node scripts/open-nation-rolling-round.mjs --dry-run
--   node scripts/open-nation-rolling-round.mjs
--
-- 2 Final nations — deadline rule: hard = kickoff − 1h30, raise = hard − 1h.
-- All times in Europe/Dublin (IST = UTC+1 in July).
--
-- Fixture schedule:
--   Spain       vs Argentina     19 Jul 20:00  →  raise 17:30       hard 18:30
--     (15:00 ET MetLife = 20:00 Dublin)
--
-- Final auction close (global hard_deadline_at): 19 Jul 2026 18:30 Europe/Dublin
--
-- GW8 is created but NOT activated on leaderboards (GW7 Semi Finals stays active
-- until Final squad lock).

-- ─── 0) Ensure GW8 exists; leave GW7 active on leaderboards ───────────────────
insert into public."Game_Weeks" (id, "GW_Name", "Is_Active")
values (8, 'FIFA World Cup Finals', false)
on conflict (id) do update
  set "GW_Name" = excluded."GW_Name";

-- Do NOT deactivate GW7 — SF locked squads remain the leaderboard "this gameweek"
-- until Final squads are locked.

-- ─── 1) Switch auctions 5, 6, 7 to nation_rolling for GW8 ─────────────────────
update public."Auctions"
set
  bidding_deadline_mode  = 'nation_rolling',
  rolling_game_week_id   = 8,
  hard_deadline_at       = (timestamp '2026-07-19 18:30:00' at time zone 'Europe/Dublin'),
  initiation_deadline_at = null,
  raise_deadline_at      = null,
  is_active              = true
where id in (5, 6, 7);

-- ─── 2) Reset paid release quota for the Final window ────────────────────────
update public.auction_users
set paid_release_used = false
where auction_id in (5, 6, 7);

-- ─── 3) Re-open unsold lots so managers can bid on Final nations' players ────
-- Sold players remain sold. Elimination-refund / never-bid players (unsold)
-- go back to uninitiated. Non-Final nations' players stay visible but place_bid
-- returns nation_not_in_round — expected behaviour.
update public.auction_lots
set
  status                 = 'uninitiated',
  expires_at             = null,
  current_high_bid_id    = null,
  current_high_bidder_id = null
where auction_id in (5, 6, 7)
  and status = 'unsold';

-- ─── 4) Nation deadlines — 2 nations × 3 auctions = 6 rows ───────────────────
delete from public.auction_nation_deadlines
where auction_id in (5, 6, 7);

insert into public.auction_nation_deadlines
  (auction_id, team_name, kickoff_at, raise_deadline_at, hard_deadline_at)
select
  a.id                                          as auction_id,
  n.team_name,
  (n.kickoff_ts at time zone 'Europe/Dublin')   as kickoff_at,
  (n.raise_ts   at time zone 'Europe/Dublin')   as raise_deadline_at,
  (n.hard_ts    at time zone 'Europe/Dublin')   as hard_deadline_at
from public."Auctions" a
cross join (values
  -- Final: Spain vs Argentina — 19 Jul 2026 20:00 Dublin
  ('Spain',     timestamp '2026-07-19 20:00:00', timestamp '2026-07-19 17:30:00', timestamp '2026-07-19 18:30:00'),
  ('Argentina', timestamp '2026-07-19 20:00:00', timestamp '2026-07-19 17:30:00', timestamp '2026-07-19 18:30:00')
) as n(team_name, kickoff_ts, raise_ts, hard_ts)
where a.id in (5, 6, 7);

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- select id, name, is_active, bidding_deadline_mode, rolling_game_week_id,
--        hard_deadline_at at time zone 'Europe/Dublin' as final_hard_dublin
-- from public."Auctions" where id in (5,6,7) order by id;
--
-- select auction_id, team_name,
--        raise_deadline_at at time zone 'Europe/Dublin' as raise_dublin,
--        hard_deadline_at  at time zone 'Europe/Dublin' as hard_dublin,
--        kickoff_at        at time zone 'Europe/Dublin' as kickoff_dublin
-- from public.auction_nation_deadlines where auction_id in (5,6,7)
-- order by hard_deadline_at, team_name, auction_id;
--
-- select count(*) from public.auction_nation_deadlines where auction_id in (5,6,7); -- expect 6
-- select id, "GW_Name", "Is_Active" from public."Game_Weeks" order by id;
