-- Undo security-lockdown.sql (restores the pre-Oct-2026 open state). Only if something breaks.
begin;

alter table public."Auctions"                       disable row level security;
alter table public."Game_Weeks"                     disable row level security;
alter table public."Player_Scores"                  disable row level security;
alter table public._backup_auctions_pre_r16         disable row level security;
alter table public._backup_game_weeks_pre_trial8    disable row level security;
alter table public.auction_bids                     disable row level security;
alter table public.auction_elimination_refunds      disable row level security;
alter table public.auction_leaderboard              disable row level security;
alter table public.auction_lots                     disable row level security;
alter table public.auction_nation_deadlines         disable row level security;
alter table public.auction_participant_relegations  disable row level security;
alter table public.auction_releases                 disable row level security;
alter table public.auction_score_breakdown          disable row level security;
alter table public.auction_teams                    disable row level security;
alter table public.auction_transfers                disable row level security;
alter table public.auction_users                    disable row level security;
alter table public.competition_matches              disable row level security;
alter table public.competition_players              disable row level security;
alter table public.competition_rounds               disable row level security;
alter table public.competitions                     disable row level security;
alter table public.gameweek_squads                  disable row level security;
alter table public.live_auction_admin_grants        disable row level security;
alter table public.players                          disable row level security;

alter view public.player_scores        reset (security_invoker);
alter view public.player_scores_scoped reset (security_invoker);

grant execute on all functions in schema public to public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant execute on functions to public, anon, authenticated;

commit;
