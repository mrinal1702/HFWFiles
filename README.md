# HFW Files

This repository contains multiple projects. The **Next.js fantasy auction app** lives in **`auction-app/`**.

## Competition data isolation

Scoring data is organized **per competition** under **`competitions/`** so multiple competitions can run without colliding. See **`docs/context/COMPETITION_AUCTION_DATA_ISOLATION.md`** for the full architecture, and each competition's **`competition.json`** for its slug, database IDs, auctions, and legacy gameweek-ID range.

```
competitions/
├── active/
│   └── epl-2026-27/            # English Premier League 2026/27 (active)
│       ├── competition.json
│       ├── player-pool/        # master_player_list.csv + squads/
│       └── rounds/mw01/        # round.json + matches/<slug>/{match.json, final-points.csv, intermediates/}
└── archive/
    ├── world-cup-2026/         # FIFA World Cup 2026 (auctions 5/6/7)
    │   ├── records/            # match FinalPoints, Best XI, rollups, rosters
    │   ├── scoring-intermediates/, player-pool/, ops/, docs/, tests/
    │   └── _pending-dedup-from-matches-raw/   # leftovers to review vs canonical records
    └── uefa-cl-2025-26/        # UEFA Champions League 2025/26 (RO16 L2 → SF L2)
        └── rounds/<round>/     # round.json + matches/, tables/, scores/
```

A **round is a gameweek** (one fixture per team), so a player's round score is their match score — never summed. Every score is tagged with its FotMob **match ID** (see `competition-matches` in the schema and each `match.json`).

> Note: archived competitions are read-only. Active scoring tools must reject archive paths.

## Auction app — UI & deployment (read this)

- **`auction-app/docs/OPS_INDEX.md`** — **canonical ops handbook** for agents (bidding, locks, scoring, relegations, eliminations, UI standards).
- **`auction-app/docs/USER_UI_AND_DEPLOYMENT.md`** — user-facing routes, bidding room behavior (including default list sorting), data summary, and pointers to Vercel setup.
- **`docs/VERCEL_DEPLOYMENT_PLAYBOOK.md`** — full Vercel checklist (root directory, webpack build, env vars, `/api/health`, common 404 causes).

## Deploying on Vercel (important)

Vercel must build from the **`auction-app`** folder, not the repository root (there is no `package.json` at the repo root).

1. Open your project on [Vercel](https://vercel.com) → **Settings** → **General**.
2. Find **Root Directory** and set it to: **`auction-app`**
3. Save, then **Deployments** → **Redeploy** the latest deployment (or push a new commit).

If Root Directory is left empty, Vercel may build the wrong thing or serve a deployment that responds with **404** on every path.

See **`docs/GIT_AND_VERCEL.md`**, **`docs/VERCEL_DEPLOYMENT_PLAYBOOK.md`**, and **`docs/VERCEL_404_TROUBLESHOOTING.md`** for env vars and troubleshooting.
