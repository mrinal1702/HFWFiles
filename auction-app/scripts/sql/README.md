# SQL canonical index (source of truth)

**What this is:** these `.sql` files are applied **by hand** in the Supabase SQL Editor — there is no migration runner. Over time, several functions were rewritten in multiple files, so the repo used to contain several copies of the same object with no marker for which one was actually live.

This index maps **every object that exists in the live database** to the **one file that holds the currently-deployed version**. It was produced by dumping the live function definitions (`pg_get_functiondef`) and the live table/column list, then diffing them against every `.sql` file.

- **Live project:** `ealowpaiiwsrbwucgkng.supabase.co`
- **Verified:** Sep 2026 (30 tables/views, 27 functions).
- Outdated copies now live in [`_superseded/`](./_superseded). Do **not** run those.
- Some files are **partially superseded** (they hold a live object *and* a dead one). Those keep a `⚠️ PARTIALLY SUPERSEDED` banner at the top pointing here.

> When you rewrite a function, update this file in the same commit.

---

## RPC functions → canonical file

| Function | Canonical file |
|---|---|
| `place_bid` | **`nation-rolling-bidding-rpc.sql`** |
| `release_player` | **`nation-rolling-bidding-rpc.sql`** |
| `finalize_due_nation_deadlines` | `nation-rolling-bidding-rpc.sql` |
| `_finalize_nation_deadline_for_auction` | `nation-rolling-bidding-rpc.sql` |
| `_player_team_name` | `nation-rolling-bidding-rpc.sql` |
| `finalize_auction_hard_deadline` | **`auction-bidding.sql`** |
| `finalize_expired_lots` | **`auction-bidding.sql`** |
| `_player_is_goalkeeper` | `auction-bidding.sql` |
| `seed_auction_lots_for_auction` | **`seed-auction-lots-competition-aware.sql`** |
| `upsert_player_scores` | `player-scores.sql` |
| `upsert_player_scores_for_round` | **`competition-isolation-migrate-all.sql`** |
| `propose_transfer`, `respond_to_transfer`, `confirm_transfer`, `cancel_transfer`, `reject_transfer`, `admin_approve_transfer`, `admin_reject_transfer`, `void_expired_transfers`, `_execute_transfer_internal`, `_player_in_active_transfer` | `auction-transfers.sql` |
| `record_live_sale`, `void_live_sale` | `live-auction-rpc.sql` |
| `create_stacked_test_auction`, `replace_auction_users_fresh_state` | `testing-auction-helpers.sql` |
| `reset_testing_environment` | `reset-testing-environment.sql` |
| `trg_auction_bids_block_relegated`, `_participant_is_relegated` | `participant-relegation-rpc.sql` |
| `handle_new_user` (auth trigger) | `auth-and-join.sql` |

---

## Tables & views → canonical file

| Table / view | Canonical file | Notes |
|---|---|---|
| `auction_lots` | `auction-bidding.sql` | |
| `auction_bids` | `auction-bidding.sql` | |
| `auction_releases` | `auction-releases.sql` | |
| `auction_transfers` | `auction-transfers.sql` | |
| `auction_nation_deadlines` | `nation-rolling-bidding-schema.sql` | |
| `auction_participant_relegations` | `participant-relegation-schema.sql` | |
| `auction_elimination_refunds` | `auction-elimination-refunds-setup.sql` | |
| `gameweek_squads` | `gameweek-squads.sql` | `xi_role` col added by `gameweek-squads-xi-role.sql` |
| `competitions`, `competition_rounds`, `competition_matches`, `competition_players` | `competition-isolation-migrate-all.sql` | |
| `player_scores` (view) | `player-scores.sql` | lowercase alias of `"Player_Scores"` — exposes `"Score"` as `score` |
| `player_scores_scoped` (view) | `competition-isolation-migrate-all.sql` | `"Player_Scores"` joined to competition/round/match |
| `profiles` | `auth-and-join.sql` | `avatar_url` col + storage policies in `profile-avatars.sql` |
| `live_auctions`, `live_auction_participants`, `live_auction_players`, `live_auction_sales` | `live-auction-schema.sql` | |
| `live_auction_admin_grants` (+ `join_code`/`admin_code`/`max_participants`) | `live-auction-dashboard-codes.sql` | |
| `"Auctions"`, `auction_users`, `auction_teams`, `players`, `"Game_Weeks"`, `"Player_Scores"` | *base tables (pre-date these scripts)* | columns added incrementally — see "column-add" files below |

**Columns added to base tables (idempotent `alter table … add column if not exists`):**

| Column(s) | Added by |
|---|---|
| `"Auctions".hard_deadline_at` | `auction-bidding.sql` |
| `"Auctions".initiation_deadline_at`, `.raise_deadline_at` | `auction-deadline-rules.sql` |
| `"Auctions".bidding_deadline_mode`, `.rolling_game_week_id` | `nation-rolling-bidding-schema.sql` |
| `"Auctions".transfers_require_admin_approval`, `.transfer_window_open` | `auction-transfers.sql` |
| `"Auctions".competition_id` | `competition-isolation-migrate-all.sql` |
| `"Auctions".join_code`, `.max_participants` | `auth-and-join.sql` |
| `"Auctions".admin_user_id` (+ non-unique admin lookup index) | `auction-admin-column.sql` |
| `auction_users.paid_release_used` | `auction-releases.sql` |
| `auction_users.team_name` | `auction-team-names.sql` |
| `auction_users.is_relegated`, `.relegated_at` | `participant-relegation-schema.sql` |
| `"Player_Scores".competition_round_id`, `.competition_match_id`, `.fotmob_match_id` | `competition-isolation-migrate-all.sql` |

**Data-only ops scripts (no schema change):**

| Script | Use |
|---|---|
| `archive-competition.sql` | Archive a finished competition: `competitions.status = 'archived'` + `archived_at`, and `is_active = false` on its auctions. The UI derives Active vs Archives from this. Applied Oct 2026 for EPL 2026/27 (competition 2). |
| `archive-wc-auctions-5-6-7.sql` | Earlier World Cup equivalent (`is_active = false` on 5/6/7). Superseded by `archive-competition.sql`. |

---

## Access control (Oct 2026)

[`security-lockdown.sql`](./security-lockdown.sql) — RLS on (no policies) for every public table except
`profiles`; score views `security_invoker`; EXECUTE on public functions for `service_role` only.
The app reaches these only via the service-role key. Undo: [`security-lockdown-rollback.sql`](./security-lockdown-rollback.sql).
New tables must `enable row level security` too.

---

## Superseded copies (do not run)

Each object below is **not** what's live; the live version is in the canonical file named.

| Object | Old copy | Live version is in |
|---|---|---|
| `place_bid` | `auction-bidding.sql` (partial), `auction-deadline-rules.sql` (partial) | `nation-rolling-bidding-rpc.sql` |
| `release_player` | `auction-releases.sql` (partial), `participant-relegation-rpc.sql` (partial), `_superseded/auction-releases-paid-when-bidding-open.sql`, `_superseded/auction-releases-fix-player-id-cast.sql` | `nation-rolling-bidding-rpc.sql` |
| `finalize_auction_hard_deadline` | `_superseded/standalone-finalize-auction-hard-deadline.sql` | `auction-bidding.sql` |
| `finalize_expired_lots` | `_superseded/standalone-finalize-expired-lots.sql` | `auction-bidding.sql` |
| `seed_auction_lots_for_auction` | `_superseded/seed-auction-lots-all-players.sql` | `seed-auction-lots-competition-aware.sql` |
| `upsert_player_scores_for_round` + isolation tables | `_superseded/competition-isolation-schema.sql` (partial schema) | `competition-isolation-migrate-all.sql` |
| `live_auction_admin_grants` + codes | `_superseded/live-auction-admin-code.sql`, `_superseded/live-auction-join-code.sql` | `live-auction-dashboard-codes.sql` |

---

## Known, deferred (separate future tasks — not part of this tidy)

- **Scoring is one table + two views (not a redundancy):** `"Player_Scores"` is the only score **table** (canonical). `player_scores` and `player_scores_scoped` are **views** over it (defined in `player-scores.sql` and `competition-isolation-migrate-all.sql`), so they always match it (~2,255 rows) and cannot drift. The app reads the lowercase `player_scores` view by preference and falls back to `"Player_Scores"`. No action needed.
- **Backup tables in production:** `_backup_auctions_pre_r16` and `_backup_game_weeks_pre_trial8` are leftover migration backups. Candidates for cleanup.
