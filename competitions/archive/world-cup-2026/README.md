# World Cup 2026 Auction — Archive

Completed **July 2026**. Three parallel online auctions (**IDs 5, 6, 7**) ran through eight gameweeks of the FIFA World Cup 2026.

This tree is the **local record** of the tournament: match scores, Best XI, player pool, scoring intermediates (for algorithm work), and commissioner ops. Active app folders are cleared for the next competition.

---

## Quick map

| What you want | Where |
|---------------|--------|
| Per-match final player scores | `records/match-final-points/` (**103** CSVs) |
| Best XI / formation overlays | `records/best-xi/` (**24** JSON = 3 auctions × 8 GWs) |
| Gameweek score rollups | `records/rollups/` |
| Cup / roster / relegation config | `records/cup-fixtures/`, `records/auction-rosters/` |
| Participant **final standings** | `records/standings/` — see README there (**export still needed**) |
| Keeper / outfield / intermediate points (algorithm) | `scoring-intermediates/` |
| Nation squads + master player list | `player-pool/` |
| SQL, backups, one-off scripts | `ops/` |
| WC runbooks & scoring lessons | `docs/` |
| WC test helpers & sample CSVs | `tests/` |

---

## `records/` — keep forever

Canonical outputs you will reopen for history, algorithm work, or restoring score pages.

```
records/
  match-final-points/   # *FinalPoints.csv — one file per match (canonical scores)
  best-xi/              # best_xi_auction_{5,6,7}_gw{1..8}.json
  rollups/              # e.g. WC2026_GW1_scores.csv
  cup-fixtures/         # QF bracket CSVs
  auction-rosters/      # Auction 3 teams CSV, relegated-participants.json
  standings/            # placeholder — export final leaderboards from Supabase
```

## `scoring-intermediates/` — for algorithm improvement

Breakdowns and audits used when building or re-checking FinalPoints. Safe to keep; not needed for day-to-day browsing.

```
scoring-intermediates/
  keeper-points/        # *KeeperPoints.csv (103)
  outfield-points/      # *Outfield_Points.csv (103)
  points/               # intermediate *Points.csv (103)
  match-json/           # small JSON kept from SF/Final scoring runs
  audits/               # GW1 position-map audits + helper .py scripts
```

## `player-pool/`

```
player-pool/
  squads/                 # ~50 nation *_Squad.json (+ pending_pool_additions.json)
  master_player_list.csv  # full WC player pool
```

## `ops/`

Commissioner SQL for rounds 5–6–7, DB backups, branding, and one-off correction scripts. Not required to read scores.

## `docs/` / `tests/`

WC-specific runbooks (elimination, trial rolling deadlines, Auction 3 import, scoring lessons) and WC-only test scripts/fixtures.

---

## Intentionally deleted earlier

**FotMob match JSON extracts** (~204 files, ~56 MB) were removed when this archive was first created. Calculated points remain in `records/match-final-points/` and `scoring-intermediates/`. Re-fetch with `Tests/fetch_fotmob_match.py` if needed.

Duplicate copies under the old `auction-app/data/match-scores/` and `auction-app/data/best-xi/` paths were removed after consolidating into `records/`.

---

## Restoring score pages in the app (optional)

1. Copy `records/match-final-points/*.csv` → `auction-app/data/match-scores/`
2. Restore `ops/lib/match-scores-sheets.ts` → `auction-app/lib/match-scores/sheets.ts`
3. Optionally copy `records/best-xi/` into `auction-app/data/best-xi/` (rename to `auction-{id}-gw{n}.json` if the app expects that pattern)
