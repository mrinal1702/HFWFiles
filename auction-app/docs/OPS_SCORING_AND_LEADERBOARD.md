# Ops: Scoring, Best XI, leaderboard & deploy

**Canonical pipeline for online auctions.**  
Related: [OPS_GAMEWEEK_LOCK.md](./OPS_GAMEWEEK_LOCK.md), repo `docs/MAIN_PIPELINE_FUNCTIONS.md`, `docs/SCORING_OPERATIONS_RUNBOOK.md` (older CL CSV path).

Tournament-specific examples (WC 2026) may live under `archive/world-cup-2026/` — extract **process**, not hard-coded paths, when training agents.

---

## End-to-end pipeline (standard)

```
FotMob match → match JSON (optional keep)
        → score to *FinalPoints.csv
        → (optional) public match-scores page
        → upsert Player_Scores (Supabase)
        → gameweek_squads already locked
        → compute Best XI (Python) → JSON
        → publish Best XI → gameweek_squads + auction_leaderboard
        → (optional) copy overlay JSON under auction-app/data/best-xi/
        → git push → Vercel (leaderboard UI)
```

**Standings are never computed in the browser from raw player scores.** They sum `auction_leaderboard.total_score` per manager ([`lib/leaderboard-data.ts`](../lib/leaderboard-data.ts) → `getLeaderboardData`).

---

## 1) Per-match points (`*FinalPoints.csv`)

- Produce one **FinalPoints** CSV per match (player id, team, position, scores).
- Intermediate CSVs (`KeeperPoints`, `Outfield_Points`, `Points`) are optional for debugging; **FinalPoints** is what the app and upsert consume.
- Validate with project validators when available (`scripts/lib/validate-final-points.mjs`, Tests helpers).

**Public match scores UI** (optional but standard for transparency):

1. Copy `*_FinalPoints.csv` → `auction-app/data/match-scores/`
2. Register the match in `lib/match-scores/sheets.ts` (slug, title, GW group)
3. Deploy — pages under `/match-scores` (and `/scores/...` redirects)

No login required for match scores.

---

## 2) Upsert into Supabase (`Player_Scores`)

```bash
cd auction-app
npm run upsert:player-scores -- --gw-id N --csv path/to/Match_FinalPoints.csv
# or batch as the script supports — see script --help
```

Script: `scripts/upsert-player-scores-from-finalpoints.mjs`  
Keeper club units remapped via `scripts/lib/keeper-player-id.mjs`.

Scores are **auction-agnostic** (by `player_id` + `game_week_id`). All auctions sharing that GW see the same player points.

Prefer this over older “publish active GW from full squad sum” paths when using Best XI scoring.

---

## 3) Formation / Best XI picking

**Input:** locked `gameweek_squads` + `Player_Scores` (+ master player list for positions).

**Compute (local, no write):**

```bash
# from repo root
python procedures/compute_auction_best_xi.py --auction-id ID --gw-id N --output Scores/best_xi_auction_ID_gwN.json
```

Core logic: `procedures/best_xi.py` (`compute_best_xi`) — legal fantasy formations, pick highest-scoring valid XI, rest bench.

**Publish (writes Supabase + optional overlay file):**

```bash
cd auction-app
npm run publish:best-xi -- --auction-id ID --gw-id N --json ../Scores/best_xi_auction_ID_gwN.json
```

Script: `scripts/publish-best-xi-from-json.mjs`

Effects:

- Sets `gameweek_squads.is_best_xi` / `xi_role`
- Replaces that auction/GW rows in **`auction_leaderboard`** with each manager’s Best XI **`total_points`**
- Writes `data/best-xi/auction-{id}-gw{n}.json` for formation overlay on the leaderboard UI

---

## 4) Standings & leaderboard UI

| Piece | Role |
|-------|------|
| `auction_leaderboard` | Authoritative GW totals (Best XI points) |
| `getLeaderboardData(auctionId)` | Sums all GW rows → season total → dense ranks (ties share rank) |
| `/leaderboard/[auctionId]` | Standings tab + per-GW squad tabs |
| Overlay JSON | Formation string + slot roles for display |

**Position column** = season rank from summed leaderboard rows.  
**Points column** can filter GWs in the UI but rank stays season-based unless product changes that deliberately.

Relegated managers **remain** on the table (flagged).

---

## 5) Vercel

- Git push to the connected branch triggers deploy.
- Vercel **Root Directory** = `auction-app` (required).
- Smoke: `https://hfwauction.vercel.app/api/health` → `{ "ok": true }`.
- Leaderboard overlays and `match-scores` CSVs that ship with the app must be **committed** if the UI should show them in production.

See `docs/VERCEL_DEPLOYMENT_PLAYBOOK.md`.

---

## Tables (scoring)

| Table | Role |
|-------|------|
| `"Player_Scores"` / view `player_scores` | Per player per GW |
| `gameweek_squads` | Locked roster + XI flags |
| `auction_leaderboard` | Per manager per GW total |
| `auction_score_breakdown` | Optional legacy per-player auction scores — not required for Best XI path |
| `Game_Weeks` | GW labels / active flag |

Schema: `scripts/sql/player-scores.sql`, `scripts/create-auction-score-tables.sql`.

---

## Standardization rules

- One pipeline for every competition: FinalPoints → upsert → Best XI → publish.
- Do not write leaderboard totals by hand in SQL unless recovering from an incident (and document it).
- Do not change formation legality in the UI — change `best_xi.py`.
- Do not publish Best XI before squads are locked for that GW.
- Keep match-score sheets and Best XI overlays in the repo so deploys stay reproducible.
