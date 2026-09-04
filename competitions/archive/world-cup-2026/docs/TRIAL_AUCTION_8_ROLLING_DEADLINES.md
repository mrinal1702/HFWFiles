# Trial auction 8 — rolling nation deadlines

Commissioner setup for the **Trial R16 Rolling** experiment. Does **not** change auctions **5, 6, or 7**.

## What you’re testing

- Per-nation **raise (+5)** and **hard** deadlines (no initiation deadline)
- **12-hour** rolling bid timer capped at nation hard deadline
- When a nation’s hard deadline passes: lots finalize + owned players **lock into `gameweek_squads`** (GW **99**)
- **No release** (paid or free) for players whose nation deadline has passed
- **Paid release** once for the whole window; **transfers off**
- Join code: **`TRIALR16`** (8 characters; dashboard allows 6–8 only)

## Schedule (Europe/Dublin)

| Fixture | Nations | Raise | Hard |
|---------|---------|-------|------|
| Game 1 — 29 Jun 21:00 | Brazil, Germany | 18:30 | 19:30 |
| Game 2 — 30 Jun 20:00 | France, England | 17:30 | 18:30 |
| Game 3 — 30 Jun 23:00 | Argentina, Portugal | 20:30 | 21:30 |

Final auction close: **30 Jun 21:30** (Portugal/Argentina hard deadline).

## Setup steps (Supabase SQL Editor)

Run **in order**, each file in full:

1. `scripts/sql/trial-8-backup-pre-setup.sql` — backup + verify prod state (no new columns required)  
2. `scripts/sql/nation-rolling-bidding-schema.sql` — adds `bidding_deadline_mode`, `auction_nation_deadlines`, etc.  
3. `scripts/sql/nation-rolling-bidding-rpc.sql`  
4. `scripts/sql/trial-8-setup.sql`  

Then **deploy** the app (or run `npm run dev` locally) so the UI uses the new leaderboard + bid logic.

## Verify

```sql
select id, name, bidding_deadline_mode, rolling_game_week_id, join_code
from public."Auctions" where id = 8;

select id, "GW_Name", "Is_Active" from public."Game_Weeks" order by id;
-- GW 99 must have Is_Active = false; prod GW (e.g. 3) still active.

select team_name,
       raise_deadline_at at time zone 'Europe/Dublin' as raise_dublin,
       hard_deadline_at at time zone 'Europe/Dublin' as hard_dublin
from public.auction_nation_deadlines
where auction_id = 8
order by hard_deadline_at;
```

## Join the trial

1. Log in at https://hfwauction.vercel.app (or local dev)  
2. Dashboard → join with code **`TRIALR16`**  
3. Bidding room: `/auctions/8/bidding-room`  
4. Leaderboard: `/leaderboard/8` (uses GW **99**, not global `Is_Active`)

## Test managers

Eight placeholder seats: **Trial manager 1** … **Trial manager 8**. Reassign `user_id` in `auction_users` if specific people should use real accounts.

## Rollback (trial only)

See commented block at bottom of `trial-8-backup-pre-setup.sql`.

## Never run on production

- `npm run reset:testing` — wipes **all** auctions and **truncates `Game_Weeks`**
