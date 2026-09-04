# Standings (participant final results)

Match scores and Best XI overlays are archived as files under `../match-final-points/` and `../best-xi/`.

**Final auction leaderboards** (participant rankings for auctions 5, 6, and 7) lived in Supabase during the tournament and were **not exported to disk** before this archive was organized.

To complete this folder later:

1. Export from the live app or Supabase for each of auctions **5**, **6**, and **7** (final GW8 / tournament totals).
2. Save as e.g. `auction-5-final-standings.csv`, `auction-6-final-standings.csv`, `auction-7-final-standings.csv`.
3. Recommended columns: `rank`, `auction_user_id`, `team_name` / manager name, `total_points`, and optionally per-GW columns.

Until then, Best XI JSON in `../best-xi/` is the best on-disk proxy for who played whom in each gameweek, but it is **not** a full standings table.
