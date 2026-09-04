# Competition and Auction Data Isolation

**Status:** Partially implemented (folder + manifest + Vercel-data layers done; Supabase migration drafted, not yet applied)  
**Purpose:** Canonical context for organizing active competitions, historical data, scoring, auctions, Supabase, and Vercel.  
**Scope:** Online auctions and their scoring workflows. The separate live-auction product is not covered here.

## Implementation status (2026-08-23)

Done:

- `competitions/active/epl-2026-27/`, `competitions/archive/world-cup-2026/`, and `competitions/archive/uefa-cl-2025-26/` created, each with a `competition.json`.
- EPL Matchweek 1 has a `round.json` and per-match folders (`match.json`, `final-points.csv`, `intermediates/`) with real FotMob match IDs (5795363–5795368).
- All Champions League rounds (RO16 L2 → SF L2) have `round.json` files with real FotMob match IDs; CL raw/scored files relocated from `Matches_Raw/CL*`, `Scores/CL_RO16_Leg2`, and CL test artifacts from `Tests/`.
- World Cup archive consolidated into `competitions/archive/world-cup-2026/`; leftover `Matches_Raw/World Cup 2026/` files staged in `_pending-dedup-from-matches-raw/` for review (not deleted).
- Legacy `Matches_Raw/`, `Scores/`, and `Player_List/` emptied; the old top-level `archive/` removed.
- Vercel display data is now competition-scoped under `auction-app/data/competitions/<slug>/match-scores/`; `loadMatchScoreCsv()` resolves by slug with a legacy fallback, and match sheets carry `competitionSlug` + `fotmobMatchId`.
- Supabase migration drafted in `auction-app/scripts/sql/competition-isolation-schema.sql` (new tables, auction FK, match-tagged `player_scores`, competition-aware upsert). **Not yet run.**

Still to do:

- Run `competition-isolation-schema.sql` in Supabase, then backfill `competition_round_id` / match IDs on existing `Player_Scores` and add the `(competition_round_id, player_id)` unique constraint.
- Confirm and fill the `auction_ids` TODOs in each `competition.json`, and the World Cup `database_round_id` values.
- Update Python tooling defaults (`Tests/fetch_fotmob_match.py`, `procedures/`, root `scripts/`) that still reference `Matches_Raw/`, `Scores/`, and `Player_List/`.
- Review and dedupe `competitions/archive/world-cup-2026/_pending-dedup-from-matches-raw/`.
- Update app player-page/leaderboard reads to filter by the auction's competition.

## 1. Core principle

A **competition** is the scoring boundary.

Examples:

- English Premier League 2026/27
- UEFA Champions League 2025/26
- FIFA World Cup 2026

An **auction** is a fantasy league played against one competition.

There may be:

- many EPL auctions using the same EPL player scores;
- many Champions League auctions using the same Champions League player scores;
- EPL and Champions League auctions running concurrently;
- the same FotMob player ID in several competitions.

The non-negotiable rule is:

> A player score belongs to one competition, one competition round, and one match. It may be shared by every auction attached to that competition, but it must never be visible to an auction attached to another competition.

Therefore:

- Haaland's EPL score is shared by all EPL auctions for that season.
- Haaland's Champions League score is shared by all Champions League auctions for that season.
- Haaland's EPL and Champions League scores are different records even though his FotMob player ID is the same.
- Archived World Cup data remains available to World Cup auctions but cannot participate in active EPL or Champions League operations.

### One match per round

For these competitions a **round is a gameweek**, and every team plays exactly one fixture per round. Therefore:

- Each player features in at most one match per round, so a player's round score **is** their match score. Scores are never summed across matches within a round.
- Every player round score is anchored to the FotMob match it came from. The match ID is a first-class identifier stored alongside the score for historical traceability and querying, not a value that has to be aggregated.
- The match ID is a real FotMob identifier. It already exists in this project: the raw match JSON carries `general.matchId`, and every match manifest stores it as `match_id` (for example, Arsenal vs Coventry City is FotMob match `5795363`). It is extracted automatically from the match URL by `Tests/fetch_fotmob_match.py`.

## 2. Required terminology

Agents and code must keep these concepts separate.

| Concept | Meaning | Example |
|---|---|---|
| Competition | Real-world tournament or league for one season/edition | `epl-2026-27` |
| Auction | One fantasy league attached to a competition | Auction 9 |
| Competition round | A scoring period inside the competition; one gameweek | EPL MW1, CL QF Leg 1 |
| Match | One real fixture within a competition round | Arsenal vs Coventry |
| Match identity | FotMob match ID | Arsenal vs Coventry = `5795363` |
| Player identity | FotMob player ID | Haaland's FotMob ID |
| Competition player | A player's membership/position/team within one competition | Haaland at Manchester City in EPL |
| Player round score | One player's score in one competition round, anchored to the match played | Haaland, EPL MW1, match 5795363, 42 points |
| Auction squad snapshot | Players owned by one manager at an auction deadline | Auction 9, MW1 |
| Auction result | Best XI and manager total for one auction round | Auction 9 manager total |

## 3. Current risk

The current schema has no competition identifier.

`Player_Scores` is unique on:

```text
(player_id, game_week_id)
```

This is not safe for concurrent competitions.

If EPL MW1 and Champions League MW1 both use `game_week_id = 1`, the same FotMob player ID can only have one score record. A later upsert can overwrite, merge with, or be read by the wrong competition.

Other current global assumptions include:

- one global `Game_Weeks.Is_Active`;
- one global `players` pool;
- one active match-score registry in the Vercel app;
- player pages that read scores by player ID without competition scope;
- archived auction match-score pages that can display the active competition's CSV registry.

Folder isolation is necessary, but it does not solve these database and application risks by itself.

## 4. Target relationship model

```text
Competition
  ├── has many Competition Rounds
  ├── has many Competition Matches
  ├── has many Competition Players
  ├── has many Player Round Scores
  └── has many Auctions

Auction
  ├── belongs to exactly one Competition
  ├── has many Participants
  ├── has live Squads
  ├── has frozen Round Squad Snapshots
  └── has auction-specific Best XI results and standings
```

Scores are competition-scoped but auction-independent.

Best XI, ownership, budgets, bids, releases, relegations, and standings are auction-scoped.

## 5. Proposed repository structure

```text
HFWFiles/
├── src/
│   └── hfw_scoring/                       # Shared competition-agnostic engine
├── tools/
│   ├── scoring/                           # Fetch, score, validate, publish commands
│   └── investigation/                     # Explicit one-off audits
├── procedures/                            # Auction/GW orchestration
├── tests/                                 # Unit/integration tests and curated fixtures
├── docs/
│   └── context/                           # High-level architecture and agent context
│
├── competitions/
│   ├── active/
│   │   ├── epl-2026-27/
│   │   │   ├── competition.json
│   │   │   ├── player-pool/
│   │   │   │   ├── master_player_list.csv
│   │   │   │   └── squads/
│   │   │   ├── rounds/
│   │   │   │   ├── mw01/
│   │   │   │   │   ├── round.json
│   │   │   │   │   ├── matches/
│   │   │   │   │   │   └── <match-slug>/
│   │   │   │   │   │       ├── match.json
│   │   │   │   │   │       ├── manifest.json
│   │   │   │   │   │       ├── final-points.csv
│   │   │   │   │   │       └── intermediates/
│   │   │   │   │   ├── rollup.csv
│   │   │   │   │   └── validation-report.json
│   │   │   │   └── mw02/
│   │   │   ├── auction-outputs/
│   │   │   │   ├── auction-<id>/
│   │   │   │   │   └── best-xi/
│   │   │   ├── publish/
│   │   │   │   ├── match-scores/
│   │   │   │   └── best-xi/
│   │   │   └── ops/
│   │   │       ├── run-manifests/
│   │   │       ├── audits/
│   │   │       └── backups/
│   │   │
│   │   └── uefa-cl-<season>/              # Same structure; can run concurrently
│   │
│   └── archive/
│       ├── world-cup-2026/
│       └── uefa-cl-2025-26/
│
├── auction-app/
│   ├── app/
│   ├── lib/
│   ├── scripts/
│   └── data/
│       └── competitions/
│           ├── epl-2026-27/
│           │   ├── match-scores/
│           │   └── best-xi/
│           ├── uefa-cl-2025-26/
│           └── world-cup-2026/
│
└── .work/                                 # Local generated scratch; gitignored
    └── scoring/
```

### Why this shape

- `src/`, `tools/`, `procedures/`, and `tests/` contain reusable software.
- `competitions/active/` contains writable operational data for live competitions.
- `competitions/archive/` contains completed, read-only competition records.
- Each competition owns its player pool, rounds, match inputs, validated outputs, and run history.
- Each competition can list multiple auction IDs.
- Auction-specific Best XI files are separated from shared competition score files.
- `auction-app/data/competitions/` contains only files required by Vercel for participant-facing pages.
- `.work/` contains disposable intermediates and is never treated as canonical.

## 6. Competition manifest

Every active or archived competition must have one `competition.json`.

Example:

```json
{
  "slug": "epl-2026-27",
  "display_name": "English Premier League 2026/27",
  "status": "active",
  "database_competition_id": 1,
  "auction_ids": [9, 12, 13],
  "player_pool": "player-pool/master_player_list.csv",
  "rounds": {
    "mw01": {
      "database_round_id": 101,
      "display_name": "Matchweek 1",
      "status": "published"
    },
    "mw02": {
      "database_round_id": 102,
      "display_name": "Matchweek 2",
      "status": "open"
    }
  },
  "archived_at": null
}
```

Rules:

- Competition slugs are lowercase and stable.
- Auction IDs must belong to only one competition.
- Round slugs are unique within a competition.
- Scripts must resolve paths and database IDs from this manifest.
- Scripts must not infer the competition from a folder name, GW number, current date, or previous run.

## 7. Round and match manifests

Each round should have a `round.json` containing:

- competition slug;
- database competition and round IDs;
- display name;
- fixture list;
- expected match count;
- auction IDs consuming the round;
- squad-lock state;
- scoring state;
- publication/finalization state;
- algorithm/policy version.

Each match manifest should contain:

- competition slug;
- round slug;
- FotMob match ID;
- source URL;
- home and away teams;
- raw JSON path;
- FinalPoints path;
- validation status;
- scoring policy version;
- file hashes.

This prevents an agent from scoring an EPL match into a Champions League round merely because the same player or GW number appears in both.

## 8. Proposed Supabase model

### New competition tables

```text
competitions
  id
  slug                 UNIQUE
  name
  status               active | completed | archived
  archived_at

competition_rounds
  id
  competition_id       FK competitions
  round_slug
  display_name
  round_number
  status
  is_active
  UNIQUE (competition_id, round_slug)

competition_matches
  id
  competition_id       FK competitions
  round_id              FK competition_rounds
  fotmob_match_id
  match_slug
  played_at
  UNIQUE (competition_id, fotmob_match_id)

competition_players
  competition_id       FK competitions
  player_id             FotMob player ID
  player_name
  position
  team_id
  team_name
  PRIMARY KEY (competition_id, player_id)
```

### Required auction relationship

`Auctions` must gain:

```text
competition_id FK competitions
```

Every online auction belongs to exactly one competition.

### Required score relationship

The preferred score key is:

```text
player_scores
  competition_round_id     FK competition_rounds
  player_id                FotMob player ID
  competition_match_id     FK competition_matches (the fixture this score came from)
  fotmob_match_id          raw FotMob match ID, denormalised for traceability
  score
  PRIMARY KEY (competition_round_id, player_id)
```

Because `competition_round_id` belongs to one competition, the same FotMob player can safely have:

```text
Haaland + EPL MW1 + match 5795363
Haaland + Champions League MW1 + match <cl-match-id>
Haaland + World Cup round + match <wc-match-id>
```

as three separate score records.

Since a round is a gameweek and every team plays exactly one fixture per round, `(competition_round_id, player_id)` already uniquely identifies a score, so it remains the primary key. The match ID is stored as an attribute rather than part of the key: it records **which fixture** a player's points came from, enabling direct match-level history queries (for example, "show every score from match 5795363") without ever summing scores across matches. Scores must not be added together within a round; the match score is the round score.

An alternative transitional key is:

```text
(competition_id, game_week_id, player_id)
```

but a first-class `competition_round_id` is cleaner and avoids treating round numbers as globally meaningful.

### Tables that remain auction-scoped

The following should continue to use `auction_id`:

- `auction_users`
- `auction_lots`
- `auction_bids`
- `auction_teams`
- `gameweek_squads`
- `auction_leaderboard`
- `auction_releases`
- `auction_transfers`
- `auction_participant_relegations`
- `auction_elimination_refunds`

Where a table currently stores `game_week_id`, it should reference `competition_round_id`.

## 9. Score flow under the new model

```text
Competition round manifest
  → Fetch each FotMob match (record its FotMob match ID)
  → Save under that competition/round only
  → Run shared scoring engine
  → Validate FinalPoints
  → Upsert by competition_round_id + player_id, tagging each row with its match ID
  → Lock/read auction squads for auctions attached to the competition
  → Compute Best XI separately for each auction
  → Publish auction-specific totals
  → Stage competition-specific Vercel artifacts
```

The scoring command should require:

```text
--competition <slug>
--round <round-slug>
```

It should not accept a bare `--gw-id` as sufficient production context.

Before writing, the command must verify:

1. the competition is active;
2. the round belongs to that competition;
3. every target auction belongs to that competition;
4. every input match manifest names that competition and round;
5. every input match manifest carries a resolvable FotMob match ID;
6. the expected fixture count is met or an explicit partial-run flag is supplied;
7. the correct player pool is loaded;
8. archived competitions are read-only;
9. the output path remains inside the selected competition directory.

## 10. Vercel and participant-facing data

Vercel should not depend on `Matches_Raw/`, `Scores/`, or a single global match-score directory.

Recommended deployed structure:

```text
auction-app/data/competitions/<competition-slug>/
├── match-scores/
├── best-xi/
├── fixtures.json
└── competition.json
```

Application behavior:

1. Resolve the auction.
2. Read its `competition_id` or competition slug.
3. Load match scores, fixtures, round labels, positions, and archive data for that competition only.

Public `/match-scores` may show several competitions, but users must explicitly select a competition. It must not use one global registry as the implicit source for every auction.

Archived auction routes must continue to resolve their archived competition data. An archived World Cup auction must never render EPL match sheets.

Supabase remains authoritative for:

- auction membership;
- ownership and locked squads;
- player round scores;
- Best XI flags;
- manager round totals;
- standings.

Vercel-bundled files are transparency/display artifacts, not the authoritative scoring database.

## 11. Active, completed, and archived lifecycle

### Active

- Stored under `competitions/active/<slug>/`.
- Writable only through competition-aware tools.
- May have any number of attached auctions.
- Scores may be added for open rounds.

### Completed

- No future rounds are expected.
- Final standings and operational manifests are exported.
- Score and Best XI corrections require an explicit commissioner amendment.

### Archived

- Moved to `competitions/archive/<slug>/`.
- Manifest status changed to `archived`.
- Database competition status and `archived_at` updated.
- Attached auctions remain visible in Archives.
- Records are read-only by default.
- Active scoring tools must reject the competition.
- Historical Vercel data remains available under its competition slug.

## 12. Migration map for current data

### Existing EPL auction

Target:

```text
competitions/active/epl-2026-27/
```

Move after verification:

- EPL squad JSONs and master player list;
- EPL raw match JSON and manifests currently misplaced under `Matches_Raw/World Cup 2026/`;
- EPL scored CSVs under `Matches_Raw/Premier League GW1/`;
- EPL Vercel match-score staging files.

The season slug must be confirmed before migration.

### Completed UEFA Champions League data

Target:

```text
competitions/archive/uefa-cl-2025-26/
```

Move after deduplication:

- `Matches_Raw/CL_RO16_Leg2/`;
- `Matches_Raw/CL_Quarters_Leg1/`;
- `Matches_Raw/CL_Quarters_Leg2/`;
- `Matches_Raw/CL Semis Leg1/`;
- `Matches_Raw/CL Semis Leg 2/`;
- `Matches_Raw/CL Quarters Leg2 Tables/`;
- related `Scores/` rollups and match outputs;
- related CL artifacts currently stored in `Tests/`.

The exact competition season and which rounds form one archive must be confirmed before migration.

### World Cup 2026

Target:

```text
competitions/archive/world-cup-2026/
```

The current `archive/world-cup-2026/` is the starting canonical record.

Before moving it:

- verify remaining World Cup files under `Matches_Raw/World Cup 2026/` against the archive;
- move missing canonical files;
- delete only confirmed duplicates;
- move the leftover pending-player artifact from `Player_List/World Cup 2026/`;
- keep auctions 5, 6, and 7 attached to the World Cup competition;
- preserve participant access to World Cup standings and match-score history.

## 13. Temporary safety rules before schema migration

Until competition-aware database keys are implemented:

1. Allocate non-overlapping legacy `game_week_id` ranges by competition.
2. Record those ranges in each `competition.json`.
3. Never use bare GW numbers in filenames or commands.
4. Do not use `publish-active-gameweek-scores.mjs` for production.
5. Require explicit FinalPoints file paths and competition/round confirmation before upsert.
6. Never run `--prune-gw` without verifying the competition's reserved ID range.
7. Filter player pages and owned-points views to gameweeks attached to the auction.
8. Do not run active scoring tools against any archive path.

Example temporary ranges:

```text
World Cup 2026: preserved legacy IDs 1–99
EPL 2026/27: 100–199
UEFA CL 2026/27: 200–299
```

These ranges are a temporary collision-avoidance measure, not the final data model.

## 14. AI-agent operating rules

An agent must never:

- infer a competition from a player's FotMob ID;
- infer a competition from `game_week_id`;
- use the globally active gameweek as sufficient context;
- upload a file whose competition and round are not declared;
- load a global player pool for a competition-scoped operation;
- write active outputs into an archive;
- mutate archived scores without explicit commissioner approval;
- show the active competition's match-score registry inside an archived auction;
- compute Best XI from matches outside the selected competition round.

An agent must always:

1. identify the competition slug;
2. identify the competition round;
3. load the competition manifest;
4. verify each auction belongs to that competition;
5. use the competition-specific player pool;
6. validate all match manifests;
7. produce a run manifest containing exact inputs and hashes;
8. dry-run database changes;
9. verify row counts and identifiers before publishing;
10. record whether the round is partial, published, finalized, or amended.

If any of those values are missing or contradictory, the correct action is to stop and ask the commissioner.

## 15. Decisions still required

Before implementation, confirm:

1. The exact season slug for the active EPL competition.
2. The exact season and scope of the completed Champions League archive.
3. Whether archived public match-score CSVs should remain bundled with Vercel indefinitely.
4. Whether scores may be amended after a round is finalized, and what approval/audit is required.
5. Whether competition player positions are frozen for a season or versioned by round.
6. Whether fixtures should live entirely in Supabase or be mirrored in competition manifests.
7. Whether the existing `players` table becomes a global identity table plus `competition_players`, or is replaced outright.

## 16. Recommended implementation order

1. Approve terminology and folder structure.
2. Confirm a resolvable FotMob match ID exists for every match to be migrated or scored. *(Confirmed available: raw JSON `general.matchId` and manifest `match_id`, extracted by `Tests/fetch_fotmob_match.py`.)*
3. Create competition manifests for EPL, World Cup, and completed Champions League data.
4. Introduce temporary non-overlapping gameweek ID ranges.
5. Add `competitions`, `competition_rounds`, and `competition_matches` to Supabase.
6. Attach every auction to one competition.
7. Scope `Player_Scores` by competition round, and tag each score with its FotMob match ID.
8. Scope player pools and match registries by competition.
9. Update scoring, Best XI, player-page, leaderboard, and Vercel reads.
10. Move active EPL files into its competition tree.
11. Consolidate World Cup data into its archive.
12. Create the Champions League archive and remove it from active workflows.
13. Add repository agent rules only after the architecture is working and tested.
