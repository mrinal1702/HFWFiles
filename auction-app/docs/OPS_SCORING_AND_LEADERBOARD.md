# Ops: Scoring, Best XI, leaderboard & deploy

**Canonical pipeline for online auctions.**  
Related: [OPS_GAMEWEEK_LOCK.md](./OPS_GAMEWEEK_LOCK.md), [ui-contracts/LEADERBOARD.md](./ui-contracts/LEADERBOARD.md), repo `docs/MAIN_PIPELINE_FUNCTIONS.md`.

Tournament-specific examples (WC 2026) may live under `archive/world-cup-2026/` — extract **process**, not hard-coded paths, when training agents.

**Last standardized:** Sep 2026 (UCL 2026/27 GW1 — auctions 10–13, legacy GW 300).

---

## End-to-end pipeline (standard)

```
FotMob match → match JSON (keep under competition round)
        → score to *FinalPoints.csv
        → copy FinalPoints into auction-app/data/competitions/<slug>/match-scores/
        → register sheet in lib/match-scores/sheets.ts (competition group)
        → upsert Player_Scores (Supabase) using that competition’s legacy game_week_id
        → confirm gameweek_squads locked for every target auction
        → compute Best XI (Python) → Scores/best_xi_auction_{id}_gw{N}.json
        → publish Best XI → gameweek_squads + auction_leaderboard
             + writes data/best-xi/auction-{id}-gw{N}.json
        → git commit + push: sheets/CSVs + best-xi overlays (+ any app wiring)
        → Vercel deploy → Standings / My Points / Competitors / Match Pos / formation
```

**Standings are never computed in the browser from raw player scores.** They sum `auction_leaderboard.total_score` per manager ([`lib/leaderboard-data.ts`](../lib/leaderboard-data.ts) → `getLeaderboardData`).

**UI for My Points / Competitors is frozen.** Do not add columns or tabs. Populate existing fields via data + overlays only — see [LEADERBOARD.md](./ui-contracts/LEADERBOARD.md).

---

## Legacy `game_week_id` ranges (do not collide)

Scores and locks use global `Game_Weeks.id` / `Player_Scores.game_week_id`. Competitions use non-overlapping ranges:

| Competition | Slug | `competition_id` | Auctions (examples) | Legacy GW range | Example MW1 |
|-------------|------|------------------|---------------------|-----------------|-------------|
| FIFA World Cup 2026 | `world-cup-2026` | 1 | 5, 6, 7 | 1–99 | 1 |
| English Premier League 2026/27 | `epl-2026-27` | 2 | 9 | 100–199 | 100 |
| UEFA Champions League 2025/26 | `uefa-cl-2025-26` | 3 | — | 200–299 | — |
| UEFA Champions League 2026/27 | `uefa-cl-2026-27` | 4 | 10, 11, 12, 13 | 300–399 | **300** |

Always use the **legacy** id (`competition.json` / `rounds/mwNN/round.json` → `legacy_game_week_id`) for `--gw-id`, upserts, locks, Best XI, and overlay filenames — not “GW1” as the number `1` unless the competition’s range actually starts at 1.

---

## 1) Per-match points (`*FinalPoints.csv`)

- Produce one **FinalPoints** CSV per match (player id, team, **position**, scores).
- Intermediate CSVs are optional for debugging; **FinalPoints** is what the app and upsert consume.
- The `position` column is the **in-match / simulator scoring role** (defender / midfielder / forward / goalkeeper) from FotMob-driven scoring. That same role feeds Best XI eligibility and the leaderboard **Match Pos** column.

**Public / in-auction match scores + Match Pos source (required for UI):**

1. Copy `*_FinalPoints.csv` → `auction-app/data/competitions/<slug>/match-scores/`
2. Register the match in [`lib/match-scores/sheets.ts`](../lib/match-scores/sheets.ts) under that competition’s sheet list (`groupStageGw` = **ordinal** matchweek 1, 2, 3… within the competition — not the legacy id)
3. Commit + deploy

Match Pos on My Points / Competitors is loaded by [`lib/match-positions-for-gw.ts`](../lib/match-positions-for-gw.ts):

- Resolves the auction’s `competition_id`
- Maps legacy `game_week_id` → ordinal MW (UCL: `300 → 1`, `301 → 2`, …)
- Reads `position` from that competition’s registered FinalPoints sheets

Without registered sheets **and** a deploy, Match Pos stays `—` even when scores exist in Supabase.

---

## 2) Upsert into Supabase (`Player_Scores`)

```bash
cd auction-app
npm run upsert:player-scores -- --gw-id N --csv path/to/Match_FinalPoints.csv
# Prefer competition-round helpers when available — see script --help
```

Script: `scripts/upsert-player-scores-from-finalpoints.mjs`  
Keeper club units remapped via `scripts/lib/keeper-player-id.mjs`.

Scores are **auction-agnostic** (by `player_id` + `game_week_id`). All auctions sharing that GW see the same player points.

---

## 3) Lock squads (before Best XI)

See [OPS_GAMEWEEK_LOCK.md](./OPS_GAMEWEEK_LOCK.md).

```bash
cd auction-app
node scripts/lock-gameweek-squads.mjs --gw-id N --auction-ids 10,11,12,13 --gw-name "…"
```

**Check first** whether `gameweek_squads` already has rows for that auction/GW (counts should match `auction_teams`). If already locked, **do not** re-run the lock script solely to “be safe”: it sets global `Game_Weeks.Is_Active` to this GW and clears other competitions’ active flag.

---

## 4) Formation / Best XI picking

**Input:** locked `gameweek_squads` + `Player_Scores` + competition **master player list** + match JSON (in-match roles).

**Compute (local, no Supabase write):**

```bash
# from repo root — use THIS competition’s master list and a flat folder of *Vs*.json
python procedures/compute_auction_best_xi.py \
  --auction-id ID \
  --gw-id N \
  --master competitions/active/<slug>/player-pool/master_player_list.csv \
  --matches-dir path/to/flat_match_json_folder \
  --output Scores/best_xi_auction_ID_gwN.json
```

- `--matches-dir` must be a **flat** directory of match JSON files named like `*_Vs_*.json` (no manifests). For competition round trees, stage copies into a temp folder first.
- Core logic: `procedures/best_xi.py` — legal formations; eligibility = listed pool role ∪ in-match roles; rest bench.

**Publish (writes Supabase + overlay file):**

```bash
cd auction-app
npm run publish:best-xi -- --auction-id ID --gw-id N --json ../Scores/best_xi_auction_ID_gwN.json
```

Script: `scripts/publish-best-xi-from-json.mjs`

Effects:

- Sets `gameweek_squads.is_best_xi` / `xi_role`
- Replaces that auction/GW rows in **`auction_leaderboard`** with each manager’s Best XI **`total_points`**
- Writes **`data/best-xi/auction-{id}-gw{N}.json`** (formation + XI slots for the UI)

### Formation on My Points / Competitors (required deploy artifact)

| Piece | Role |
|-------|------|
| Overlay file | `auction-app/data/best-xi/auction-{auctionId}-gw{legacyGameWeekId}.json` |
| Loader | [`lib/best-xi-overlay.ts`](../lib/best-xi-overlay.ts) → `loadBestXiOverlay` |
| UI | [`GwPointsView`](../app/leaderboard/[auctionId]/_components/GwPointsView.tsx) / [`GwSquadTable`](../app/leaderboard/[auctionId]/_components/GwSquadTable.tsx) — Best XI score + formation chip + Starting XI / Bench |

Filename **must** use the same legacy `game_week_id` as Supabase (e.g. UCL MW1 → `auction-10-gw300.json`, not `…-gw1.json`).

Publish creates the file locally. **Standings update from Supabase immediately; formation does not appear in production until the overlay JSON is committed and Vercel deploys.** This is not optional for a finished GW handoff.

Do not invent a second formation UI or competition-specific leaderboard layout.

---

## 5) Standings & leaderboard UI

Live route: `/auctions/[auctionId]/leaderboard` (`/leaderboard/[auctionId]` redirects). Tabs: **Standings | My Points | Competitors** — contract in [LEADERBOARD.md](./ui-contracts/LEADERBOARD.md).

| Piece | Role |
|-------|------|
| `auction_leaderboard` | Authoritative GW totals (Best XI points after publish) |
| `getLeaderboardData(auctionId)` | Sums all GW rows → season total → dense ranks (ties share rank) |
| Match Pos | FinalPoints `position` via competition sheets + `loadMatchPositionsForGameweek` |
| Formation | Overlay JSON via `loadBestXiOverlay` |
| Starting XI / Bench | `gameweek_squads.is_best_xi` (+ overlay roles) |

Relegated managers **remain** on Standings (flagged).

---

## 6) Vercel

- Git push to the connected branch triggers deploy.
- Vercel **Root Directory** = `auction-app` (required).
- Smoke: `https://hfwauction.vercel.app/api/health` → `{ "ok": true }`.
- **Must commit for production UI:** competition match-score CSVs, `sheets.ts` registrations, and `data/best-xi/auction-*-gw*.json` overlays.

See `docs/VERCEL_DEPLOYMENT_PLAYBOOK.md`.

---

## Done checklist (one GW, one competition’s auctions)

Use this before calling the GW “live” for participants:

1. [ ] All FinalPoints for the MW scored; CSVs under `data/competitions/<slug>/match-scores/`
2. [ ] Sheets registered; `groupStageGw` = ordinal MW
3. [ ] `Player_Scores` upserted for legacy `game_week_id`
4. [ ] `gameweek_squads` locked for every auction id (verify counts; avoid needless re-lock)
5. [ ] Best XI computed + published for every auction → `auction_leaderboard` rows exist
6. [ ] Overlay JSON files exist under `data/best-xi/` named with legacy GW id
7. [ ] Git commit + push of CSVs / sheets / overlays (and any loader fixes)
8. [ ] Smoke: Standings totals; My Points shows Best XI + **formation**; Match Pos filled for players who played

---

## Tables (scoring)

| Table | Role |
|-------|------|
| `"Player_Scores"` / view `player_scores` | Per player per GW |
| `gameweek_squads` | Locked roster + XI flags |
| `auction_leaderboard` | Per manager per GW total |
| `auction_score_breakdown` | Optional legacy — not required for Best XI path |
| `Game_Weeks` | GW labels / active flag |

Schema: `scripts/sql/player-scores.sql`, `scripts/create-auction-score-tables.sql`.

---

## Standardization rules

- One pipeline for every competition: FinalPoints → sheets + upsert → lock → Best XI → publish → **commit overlays/CSVs** → deploy.
- Do not write leaderboard totals by hand in SQL unless recovering from an incident (and document it).
- Do not change formation legality in the UI — change `best_xi.py`.
- Do not publish Best XI before squads are locked for that GW.
- Do not treat formation overlay or Match Pos sheets as “optional local-only” artifacts — production UI depends on them in-repo.
- Do not add leaderboard UI columns/tabs for a new competition; only data and registry grow.
- When locking, remember `Is_Active` is **global** — concurrent competitions need care (see OPS_GAMEWEEK_LOCK).
