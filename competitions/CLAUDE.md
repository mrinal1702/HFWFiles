# Competition data (no code that the app runs)

One folder per real-world competition. **Data and records only** — raw match JSON, FinalPoints,
player pools, Best XI outputs, one-off ops scripts and backups.

```
active/<slug>/      writable — the competition being played now
archive/<slug>/     read-only history (do not modify without explicit approval)
```

| Slug | id | Auctions | Legacy GW ids | Where |
|------|----|----------|---------------|-------|
| `uefa-cl-2026-27` | 4 | 10, 11, 12, 13 | 300+ (MW1 = 300) | `active/` |
| `epl-2026-27` | 2 | 9 | 100–103 | `archive/` |
| `world-cup-2026` | 1 | 5, 6, 7 | 1–8 | `archive/` |
| `uefa-cl-2025-26` | 3 | — | 200–204 | `archive/` |

## Layout of a competition
- `competition.json` — slug, DB ids, auction ids, legacy GW range, status. **Scripts must read ids
  from here, never infer them.**
- `player-pool/` — `master_player_list.csv` (listed positions) + `squads/*.json`
- `rounds/mwNN/` — `round.json` (fixtures + FotMob match ids + states) and
  `matches/<slug>/{match.json, final-points.csv, intermediates/}`
- `ops/` — one-off scripts, SQL, audits, backups for that competition

## What the website reads
Not this folder. Vercel only sees `auction-app/data/competitions/<slug>/` (copied FinalPoints)
and `auction-app/data/best-xi/`. Supabase is the source of truth for scores and standings.

Architecture: `../docs/context/COMPETITION_AUCTION_DATA_ISOLATION.md`.
