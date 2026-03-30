# Vercel deployment playbook (HFW monorepo + `auction-app`)

This document captures **what actually mattered** when deploying the Next.js fantasy auction app to Vercel, including pitfalls that caused **404 on every route** and how they were resolved. It is written for **humans** and **AI agents** debugging the same setup later.

**Related files**

- `auction-app/docs/USER_UI_AND_DEPLOYMENT.md` — product UI (routes, bidding room, default sort), deployment summary, links here  
- `docs/GIT_AND_VERCEL.md` — Git push + env vars summary  
- `docs/VERCEL_404_TROUBLESHOOTING.md` — 404 checklist, SPA rewrite warning, `/vercel-check.txt` + `/api/health`  
- Repo root `README.md` — **Root Directory must be `auction-app`**

---

## 1. Repository layout (critical)

| Location | Role |
|----------|------|
| **Git repo root** | `HFWFiles` (or your clone path). **No `package.json` at this root.** |
| **Next.js app** | **`auction-app/`** — all `npm` scripts, `app/`, `next.config.ts`, `middleware.ts`, etc. |

**Vercel must use Root Directory = `auction-app`.**  
If Root Directory is empty (repo root), Vercel does not run a normal Next.js build for this project → symptoms can include **404 everywhere**, including `/` and `/api/*`.

---

## 2. Vercel project settings (working configuration)

These are the settings that aligned with a **successful** deployment:

### General / Build

- **Root Directory:** `auction-app` (no leading slash; exact folder name).
- **Framework Preset:** **Next.js** (not “Other”, not a generic Node static preset).
- **Build Command:** default or `npm run build` (see `auction-app/package.json` — production uses **`next build --webpack`**).
- **Output Directory:** **empty** (default for Next.js).  
  **Never** set this to `dist`, `build`, or `.next` unless you fully understand the override — wrong values produced **successful builds but 404 on all routes** because Vercel served the wrong output tree.
- **Install Command:** `npm ci` is declared in `auction-app/vercel.json` for reproducible installs; Vercel can also use default `npm install`.

### Node.js version

- **`package.json`** declares `"engines": { "node": ">=20.9.0" }`.
- On Vercel, **Node 22.x** was the version that worked well in practice (along with clearing overrides and other fixes). **20.x** and **22.x** are both reasonable; **24.x** may work but if builds or runtime act oddly, try **22.x** first.

### Monorepo options

- **“Include files outside the root directory in the Build step”** — can stay **enabled**; not the root cause of the 404 issue.
- **“Skip deployments when there are no changes…”** — user had this **disabled**; fine for always deploying on push.

### Ignored Build Step

- Leave **Automatic** (or default).  
- Do **not** choose “Don’t build anything” unless you intentionally want zero deployments.  
- Custom bash/node scripts are only needed if you implement your own “skip build” logic (exit `0` = skip).

---

## 3. What is in the repo on purpose (Vercel + Next 16)

### `auction-app/vercel.json`

- Sets `"framework": "nextjs"`, `installCommand`, `buildCommand` so Vercel treats the directory as a Next app consistently.

### Webpack production build

- **`"build": "next build --webpack"`** in `auction-app/package.json`.  
- Next.js 16 can use Turbopack for builds; forcing **webpack** avoided odd production behavior on Vercel in this project.

### Smoke-test endpoints

- **`GET /api/health`** — `auction-app/app/api/health/route.ts` returns JSON `{ ok: true, service: "auction-app", ... }`. If this **404**s, the deployed artifact is not this Next app (or routes are broken).
- **`GET /vercel-check.txt`** — static file in `auction-app/public/`. If this **404**s, wrong project, wrong root directory, or deployment is not serving this app’s `public/` folder.

### Git / deploy gotcha

- **`/api/health` existed only after a specific commit** — if that commit was **not pushed** to `origin/main`, Vercel kept building **older** code → **404 on `/api/health`** even when local dev had the route.  
- **Rule:** after local commits, run `git push origin main` (or your default branch) and confirm the deployment **Source** commit on Vercel matches.

---

## 4. Environment variables (Vercel)

Set in **Project → Settings → Environment Variables** (Production and Preview as needed):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (browser + server) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — bidding/join server actions; **never** expose to client or commit to Git |

Optional: `ADMIN_EMAIL` (reserved for future commissioner UI).

**These are not “Git API keys.”** GitHub connects to Vercel via normal OAuth. Supabase keys belong only in Vercel env and local `.env.local` (gitignored).

Missing Supabase vars usually cause **runtime errors or 500s**, not a blanket **404** on static routes — but they must still be set for auth and bidding to work.

---

## 5. What **not** to do (common bad advice)

### Do not apply generic “SPA” `vercel.json` rewrites to this Next.js app

Some articles (e.g. catch-all rewrite to `/` or `/index.html` + `outputDirectory: "dist"`) target **single-page apps**. **Next.js App Router** uses filesystem and server routes; those rewrites **break** `/api/*` and normal pages.

**Reference:** `docs/VERCEL_404_TROUBLESHOOTING.md` links an example DEV article and explains why it does not apply.

---

## 6. Quick diagnostic order (agent checklist)

1. Vercel deployment **Source** commit SHA = latest pushed `main` (or intended branch).  
2. **Root Directory** = `auction-app`.  
3. **Output Directory** = empty.  
4. **Framework** = Next.js.  
5. **Node** = 22.x (or 20.x) if odd runtime/build issues.  
6. Open `https://<deployment>/vercel-check.txt` → expect **200**.  
7. Open `https://<deployment>/api/health` → expect **200** JSON.  
8. Open `/` → home page.  
9. If stuck: **Redeploy** with **Clear build cache**.

---

## 7. Local vs Vercel

- Local: `cd auction-app && npm run dev` — uses `.env.local`.  
- Vercel: same env vars must be set in the dashboard; `.env.local` is **not** uploaded from Git.

---

## 8. Summary one-liner

**Monorepo: set Vercel Root Directory to `auction-app`, leave Output Directory empty, use Next.js preset, Node 22.x, push all commits to GitHub, use webpack build (`next build --webpack`), do not use SPA catch-all rewrites, verify with `/vercel-check.txt` and `/api/health`.**

---

*Playbook assembled from the deployment thread for this repository. Update if Vercel or Next.js defaults change materially.*
