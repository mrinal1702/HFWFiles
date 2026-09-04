# Owner Score Report Workflow

This document records the one-off workflow used to turn a fantasy ownership file into owner score outputs for a specific real-world round.

It is intentionally written as a **process reference**, not a rigid format contract. Input files, owner column names, output layout, and workbook presentation may change in future rounds, but the scoring logic and caveats below should stay the same unless you explicitly decide otherwise.

## Purpose

Given:
- a **player ownership file** that maps real footballer `player_id` values to fantasy owners
- a folder of match-level scoring outputs for one round

produce:
- a merged player score document for the round
- a leaderboard by owner
- a per-owner best-XI breakdown showing selected players and left-out players

## Source of truth used

### Player identity / metadata

- `Player_List/master_player_list.csv`

This is the canonical player reference for:
- `player_id`
- `player_name`
- `team_id`
- `team_name`
- mapped fantasy `position`

### Best-XI / formation rules

- `procedures/best_xi.py`
- `procedures/formation_match_roles.py`
- `Tests/position_roles.py`

These files define:
- allowed formations
- how in-match roles are resolved
- how listed roles from the master list combine with in-match roles

### Round scoring inputs

For the CL quarter-final leg 2 run, the scoring source folder was:

- `Matches_Raw/CL_Quarters_Leg2`

The script merged all files matching:

- `*FinalPoints.csv`

Each of those files contains per-player `final_score`, plus a special goalkeeper unit row per club.

### Ownership input used in this run

For this run, the ownership file was:

- `Matches_Raw/CL Quarters Leg2 Tables/master_player_list - master_player_list.tsv`

That file was a TSV derived from the player list and included an owner column:

- `Team`

Future runs may use:
- TSV or CSV
- a different filename
- a different owner column name

The only hard requirement is that each owned player can still be tied back to:
- `player_id`
- `team_id`
- `position`
- owner/team name

## Script used

The reporting script created for this workflow is:

- `scripts/build_cl_quarters_leg2_team_scores.py`

This script is currently tailored to the CL quarter-final leg 2 folder names and outputs. It can be reused as a template for future rounds, but you should expect to change paths and possibly input parsing.

## What the script does

### 1. Read the ownership file

It loads the owner assignment file and normalizes owner labels.

For this run:
- blank / `N/A` owners were ignored
- `Shah Brothers` and `Shah Bros` were normalized to `Shah Bros`

### 2. Apply manual overrides

This run included two user-requested overrides:

- `488412` `Clément Lenglet` was reassigned to `Shah Bros`
- `1173678` `Johnny Cardoso` remained owned for overall ownership reference, but was excluded from `Dosa XI` when computing best XI

If future runs have similar exceptions, document them clearly before generating outputs.

## 3. Merge the round scoring files

The script loads every `*FinalPoints.csv` in the round folder and combines them into one master score list.

For each row it records:
- source file
- player name
- player id
- team name
- position
- stat score
- endowment score
- final score

This merged file is useful both as an audit trail and as a reusable source for owner scoring.

## 4. Handle goalkeeper ownership

Goalkeepers are a special case.

Rule used:
- if an owner owns a goalkeeper from a club, that owner is treated as owning the club’s goalkeeper unit for the round

Important consequence:
- a user does not need separate credit for each keeper from that club
- the owner gets the club keeper score once

Example:
- owning a Real Madrid goalkeeper implies ownership of the Real Madrid keeper unit for that round, regardless of which specific keeper played

Operationally, this means the script:
- tracks owned goalkeeper `team_id`s by owner
- uses the keeper unit score row from the merged `FinalPoints` data
- presents only the selected keeper line in the workbook output, not every keeper row

## 5. Compute best XI

For each owner, the script builds a squad from:
- owned outfield players by `player_id`
- all goalkeepers belonging to any owned goalkeeper club, so the best-XI helper can resolve the selected GK correctly

It then calls `compute_best_xi(...)` from `procedures/best_xi.py`.

### Allowed formations

The best-XI code currently allows:
- `3-5-2`
- `3-4-3`
- `4-5-1`
- `4-4-2`
- `4-3-3`
- `5-4-1`
- `5-3-2`

### Role eligibility

Outfield eligibility is determined from:
- listed role in `master_player_list.csv`
- in-match resolved role from the round match JSON files

If a player has match role data, eligibility is:
- listed role union match role(s)

If a player does not have match role data, eligibility falls back to:
- listed role only

### Winger caveat

Some winger labels can resolve to midfielder in match-role logic depending on the granular lineup position used in the FotMob data. That logic lives in:

- `Tests/position_roles.py`

So best-XI eligibility should continue to use the existing code, not a simplified position assumption.

## 6. Outputs generated

For the CL quarter-final leg 2 run, outputs were written to:

- `Matches_Raw/CL Quarters Leg2 Tables`

### Files

- `CL_Quarters_Leg2_AllPlayerScores.csv`
- `CL_Quarters_Leg2_TeamTotals.csv`
- `CL_Quarters_Leg2_TeamBreakdown_BestXI.csv`
- `CL_Quarters_Leg2_Scoring.xlsx`

### Presentation notes

The workbook is the main presentation artifact.

Why:
- Excel can store multiple worksheets
- Excel can preserve `formation` as text
- CSV cannot contain separate tabs/sheets
- CSV may let Excel auto-convert values like `3-4-3` into dates when opened directly

## Workbook layout used

### `TeamTotals`

Presentation-facing leaderboard sorted by:
- `best_xi_total` descending

Current columns:
- owner
- best XI total
- formation
- empty outfield slots
- best XI players selected

### `AllPlayerScores`

Merged round score sheet showing all players from all `FinalPoints` files.

### One worksheet per owner

Each owner gets a dedicated sheet containing:
- owner name
- formation
- best XI total
- overall total

Then:
- a `Best XI` table ordered by `GK`, `D`, `M`, `F`
- a bold `Total` row
- a blank line
- a `Not Selected` table for owned players left out of best XI

## Why overall total and best XI total differ

These are different concepts.

- `overall_total` = sum of all owned player scores for the round
- `best_xi_total` = optimal constrained XI total after formation rules and player selection

Because some players can score zero or negative points, a best-XI total can sometimes be higher than the all-player total.

## Command used

From the repo root:

```bash
python "C:\Users\trive\HFWFiles\scripts\build_cl_quarters_leg2_team_scores.py"
```

## What is likely to change in future runs

The following should be treated as variable from round to round:
- ownership file name
- ownership file delimiter (`.tsv` vs `.csv`)
- owner column name
- round folder name
- output file names
- workbook sheet names
- whether manual overrides are needed
- whether CSV outputs are still required or whether `.xlsx` alone is enough

The following should usually stay consistent unless the scoring model itself changes:
- player identity from `master_player_list.csv`
- goalkeeper unit handling
- best-XI selection logic from `procedures/best_xi.py`
- in-match role resolution from `formation_match_roles.py` / `position_roles.py`

## Recommended future approach

If this workflow becomes recurring, refactor the current one-off script into a reusable procedure that accepts:
- ownership file path
- round score folder path
- optional overrides file
- output folder
- output workbook name

That would make the reporting process reusable without changing the underlying best-XI and scoring rules.
