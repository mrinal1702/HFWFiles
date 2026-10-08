-- Security lockdown (Oct 2026). Apply by hand in the Supabase SQL Editor. Undo: security-lockdown-rollback.sql
--
-- Why: the public anon key ships in the website bundle. Before this, every core table had RLS off
-- and anon/authenticated could UPDATE them, and every public function (incl. SECURITY DEFINER test
-- tools such as reset_testing_environment) was executable by anon.
--
-- Safe for the app: all auction/scoring/transfer reads and writes use the service-role key
-- (createAdminClient), which bypasses RLS and keeps EXECUTE. The anon/user client only touches
-- `profiles` + storage `avatars` (login, dashboard name/avatar) — left unchanged here.
-- Same pattern the live_auction_* tables already use: RLS on, no policies, service role only.

begin;

-- 1) Tables: RLS on, no policies → anon/authenticated see and change nothing; service_role unaffected.
alter table public."Auctions"                       enable row level security;
alter table public."Game_Weeks"                     enable row level security;
alter table public."Player_Scores"                  enable row level security;
alter table public._backup_auctions_pre_r16         enable row level security;
alter table public._backup_game_weeks_pre_trial8    enable row level security;
alter table public.auction_bids                     enable row level security;
alter table public.auction_elimination_refunds      enable row level security;
alter table public.auction_leaderboard              enable row level security;
alter table public.auction_lots                     enable row level security;
alter table public.auction_nation_deadlines         enable row level security;
alter table public.auction_participant_relegations  enable row level security;
alter table public.auction_releases                 enable row level security;
alter table public.auction_score_breakdown          enable row level security;
alter table public.auction_teams                    enable row level security;
alter table public.auction_transfers                enable row level security;
alter table public.auction_users                    enable row level security;
alter table public.competition_matches              enable row level security;
alter table public.competition_players              enable row level security;
alter table public.competition_rounds               enable row level security;
alter table public.competitions                     enable row level security;
alter table public.gameweek_squads                  enable row level security;
alter table public.live_auction_admin_grants        enable row level security;
alter table public.players                          enable row level security;

-- 2) Views: run with the caller's rights so they can't be used to get around RLS.
alter view public.player_scores        set (security_invoker = on);
alter view public.player_scores_scoped set (security_invoker = on);

-- 3) Functions: only the server (service_role) may call them. Trigger functions
--    (handle_new_user, trg_auction_bids_block_relegated) still fire — EXECUTE is not
--    checked when a trigger runs.
revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on all functions in schema public to service_role;

-- 4) Future functions created by postgres in public: not callable by anon/authenticated by default.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;

-- Verify (should return 0 rows each):
-- select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
--   where n.nspname='public' and relkind in ('r','p') and not relrowsecurity;
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and has_function_privilege('anon', p.oid, 'EXECUTE');
