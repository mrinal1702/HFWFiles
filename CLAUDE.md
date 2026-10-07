# HFW Files — agent map

**HFW = How Football Works.** A private fantasy football auction: friends bid on real footballers;
players score from real matches (FotMob data); managers' Best XI totals make the standings.
Live site: https://hfwauction.vercel.app (Vercel, root dir `auction-app/`). DB: Supabase.

Read **only the folder your task needs**. Each folder below has its own `CLAUDE.md` with its
inputs, outputs and rules. Do not edit outside the folder you were asked to work in.

| Task | Folder | Guide |
|------|--------|-------|
| Point-scoring algorithm + weights, FotMob fetch, stat collection, FinalPoints | `scoring-engine/` | `scoring-engine/CLAUDE.md` |
| Position-ID → role map (shared by scoring **and** formation) | `positions/` | `positions/CLAUDE.md` |
| Formation rule / Best XI, listed vs match position eligibility | `formation-engine/` | `formation-engine/CLAUDE.md` |
| Raw match data, FinalPoints, player pools, per-competition records | `competitions/` | `competitions/CLAUDE.md` |
| Website UI, Supabase reads/writes, commissioner ops scripts | `auction-app/` | `auction-app/CLAUDE.md` |
| Deploy, architecture context | `docs/` | `docs/context/` |

## How the pieces connect (fixed handoffs — keep these formats stable)

```
FotMob match JSON ──► scoring engine ──► *_FinalPoints.csv (per match)
                                            │  columns: player_name, player_id, team_name, position,
                                            │  stats_score, endowment_score, [shootout_score], final_score
                                            ▼
competitions/<slug>/ (data) ──► auction-app/scripts upsert ──► Supabase "Player_Scores"
                                            ▼
locked squads (gameweek_squads) + FinalPoints + player pool ──► formation engine ──► best_xi JSON
                                            ▼
auction-app/scripts publish ──► auction_leaderboard + data/best-xi overlays ──► Leaderboard UI
```

Changing the scoring algorithm must not require UI or formation changes as long as the
FinalPoints format is unchanged; the same holds for the Best XI JSON.

## Competitions (source of truth: Supabase `competitions` + each `competition.json`)

| Competition | id | Auctions | Legacy GW ids | Status |
|---|---|---|---|---|
| UEFA Champions League 2026/27 | 4 | 10, 11, 12, 13 | 300+ | **active — do not disturb** |
| English Premier League 2026/27 | 2 | 9 | 100–103 | archived |
| FIFA World Cup 2026 | 1 | 5, 6, 7 | 1–8 | archived |

## Hard rules
- Never mix competitions: scope every read/write by `competition_id` / `auction_id`, never by
  player id or club name (the same player/club can exist in several competitions).
- Participant UI is fixed by contracts in `auction-app/docs/ui-contracts/`. Adding a gameweek
  is data, never a UI change.
- Archived competitions are read-only (write scripts refuse them without `--allow-archived`).
- Commit to `main` deploys to production.
