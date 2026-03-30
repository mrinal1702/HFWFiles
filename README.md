# HFW Files

This repository contains multiple projects. The **Next.js fantasy auction app** lives in **`auction-app/`**.

## Auction app — UI & deployment (read this)

- **`auction-app/docs/USER_UI_AND_DEPLOYMENT.md`** — user-facing routes, bidding room behavior (including default list sorting), data summary, and pointers to Vercel setup.
- **`docs/VERCEL_DEPLOYMENT_PLAYBOOK.md`** — full Vercel checklist (root directory, webpack build, env vars, `/api/health`, common 404 causes).

## Deploying on Vercel (important)

Vercel must build from the **`auction-app`** folder, not the repository root (there is no `package.json` at the repo root).

1. Open your project on [Vercel](https://vercel.com) → **Settings** → **General**.
2. Find **Root Directory** and set it to: **`auction-app`**
3. Save, then **Deployments** → **Redeploy** the latest deployment (or push a new commit).

If Root Directory is left empty, Vercel may build the wrong thing or serve a deployment that responds with **404** on every path.

See **`docs/GIT_AND_VERCEL.md`**, **`docs/VERCEL_DEPLOYMENT_PLAYBOOK.md`**, and **`docs/VERCEL_404_TROUBLESHOOTING.md`** for env vars and troubleshooting.
