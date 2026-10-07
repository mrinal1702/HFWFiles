# Gameweek runbook (every competition, every gameweek)

**A new gameweek is DATA, never code.** The only file you create per gameweek is the round
manifest `competitions/active/<slug>/rounds/mwNN/round.json`. Everything else is a standard
command that reads it. If a step seems to need new code or a new script, stop and ask.

Run from `auction-app/` unless noted. Every DB-writing step is a **dry run unless `--apply`**:
always run it once without `--apply`, read the output, then repeat with `--apply`.

```bash
C=uefa-cl-2026-27   # competition slug
R=mw02              # round slug
```

## 1. Create the round manifest (once per gameweek)
```bash
node scripts/gameweek.mjs init-round --competition $C --round $R
```
Creates `round.json` from the previous round: `round_number`, `legacy_game_week_id`
(= competition start + n − 1; UCL 2026/27 MW2 = 301), `gw_name`, `auction_ids`,
`expected_match_count`. Then edit its **`bidding`** block:

| Field | Meaning |
|---|---|
| `initiation_deadline_at`, `raise_deadline_at`, `hard_deadline_at` | ISO UTC (e.g. `2026-10-13T15:15:00.000Z`); initiation ≤ raise ≤ hard |
| `budget_boost` | Added to every manager's budgets when the window opens (0 = none) |
| `reset_paid_release`, `reopen_unsold`, `transfer_window_open` | Usually `true` |
| `requires_locked_game_week_id` | Previous round's legacy id — opening is refused until it is locked |

Fixtures fill in automatically as matches are scored; set `expected_match_count` if known.

## 2. Open bidding
```bash
node scripts/gameweek.mjs open --competition $C --round $R          # dry run
node scripts/gameweek.mjs open --competition $C --round $R --apply
```
Refuses if the previous gameweek isn't locked or lots are still `bidding`. Re-running is safe:
auctions already on this round's hard deadline are skipped (no double budget boost). Proves
other auctions were untouched.

## 3. After the hard deadline — lock squads
```bash
node scripts/gameweek.mjs lock --competition $C --round $R          # dry run
node scripts/gameweek.mjs lock --competition $C --round $R --apply
```
Skips auctions already locked; refuses before the hard deadline or while lots are `bidding`.

## 4. Score each match as it finishes (Python, from the repo root)
```bash
python scoring-engine/score_match.py --competition $C --round $R --url "<FotMob match URL>"
```
Writes the match folder, the app CSV, the `round.json` fixture and the app's
`data/competitions/<slug>/sheets.json` entry. **The match appears on the Match scores page
under a new tab for this gameweek** (and its positions feed Match Pos) once pushed — no code.
Re-running for the same match replaces it in place.

## 5. Upload scores
```bash
node scripts/gameweek.mjs upload-scores --competition $C --round $R          # validates all files
node scripts/gameweek.mjs upload-scores --competition $C --round $R --apply  # → Player_Scores
```
Refuses if fewer than `expected_match_count` matches are scored (`--allow-partial` to override).

## 6. Best XI + standings
```bash
node scripts/gameweek.mjs best-xi --competition $C --round $R          # computes, compares with any published standings
node scripts/gameweek.mjs best-xi --competition $C --round $R --apply  # publishes standings + formation overlays
```

## 7. Verify, then commit + push (Vercel deploys)
```bash
node scripts/gameweek.mjs verify --competition $C --round $R
node scripts/gameweek.mjs status --competition $C --round $R   # any time: what's done / missing
```
Commit: `round.json`, the match folders, `auction-app/data/competitions/<slug>/` (CSVs +
`sheets.json`), `auction-app/data/best-xi/auction-*-gw<id>.json`, `auction-outputs/`.

## What participants then see (automatically, no UI work)
| Surface | New gameweek shows up as |
|---|---|
| Match scores | a new tab for the gameweek with its matches |
| Leaderboard → Standings | a new gameweek checkbox in the filter; "Select all" = overall season standings |
| Leaderboard → My Points / Competitors – Points | a new option in the gameweek dropdown (default = latest gameweek with scores) |

If any of these looks wrong, the data step is incomplete (`status` / `verify` say which) — fix the
data, never the UI. Contracts: `docs/ui-contracts/`.

## Rules
- Scores are read only for the auction's own gameweeks (`lib/scoring/player-scores.ts`).
- Archived competitions are refused unless `--allow-archived` (approved amendments only).
- Never write per-gameweek scripts (`open-xxx-gw2.mjs`…) — fill `round.json` instead.
