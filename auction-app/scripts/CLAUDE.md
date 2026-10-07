# Commissioner scripts (run from `auction-app/`; use `.env.local` service-role key)

Reuse these — do not write ad-hoc SQL or new scripts when one exists. Always dry-run first where
offered. Write scripts refuse archived competitions unless `--allow-archived` (approved amendments only).

## Gameweek pipeline (in order — full checklist: `docs/OPS_SCORING_AND_LEADERBOARD.md`)
| Step | Script |
|---|---|
| Open bidding window | `open-nation-rolling-round.mjs` (knockouts) or set deadlines on `"Auctions"`; `open-transfer-window.mjs`, `close-auction-bidding.mjs` |
| Lock squads | `lock-gameweek-squads.mjs --gw-id <legacy id> --auction-ids …` (flips global `Game_Weeks.Is_Active` — check first) |
| Load scores | `upsert-player-scores-from-finalpoints.mjs <legacy gw id> <FinalPoints.csv …>` |
| Best XI | compute in `../procedures/compute_auction_best_xi.py`, then `publish-best-xi-from-json.mjs` |
| **Verify** | `check-gameweek-surfaces.mjs [--auction-ids …]` — read-only; confirms every published GW has squads, scores, standings rows, Best XI flags, formation overlay and match sheets |

## Other operations
| Need | Script |
|---|---|
| Real teams knocked out | `apply-elimination-refunds.mjs --auction-ids … [--dry-run] "Team"` (uses the competition pool) |
| Cut managers | `apply-participant-relegations.mjs` |
| Player pool | `import-competition-players.mjs`, `import-master-player-list.mjs`, `add-players-to-pool.mjs`, `seed-auction-lots.mjs` |
| New online auction | `setup-online-auction-from-live.mjs`, `setup-auction-from-squads-csv.mjs`, `setup-auction-gw-state.mjs` |
| Live auction | `seed-live-auction-from-competition.mjs`, `seed-live-auction-players.mjs`, `apply-live-auction-dashboard-schema.mjs` |
| Inspect | `audit-player.mjs`, `health-check-auction-11.mjs [auctionId]`, `detect-backend-deals.mjs` |
| Lab / testing only | `run-reset-testing.mjs`, `replace-auction-users.mjs`, `stack-test-auction.mjs`, `setup-admin-lab-auction.mjs`, `test-deadline-rules.mjs` — never point at production auction ids |

`sql/` — manual SQL; `sql/README.md` is the canonical schema index. `lib/` — shared helpers
(keeper id remap, FinalPoints validation, archive guard). `_archive/` — finished one-offs, do not run.
