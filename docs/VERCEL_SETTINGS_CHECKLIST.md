# Vercel settings checklist (Next.js in `auction-app`)

## Do **not** do this (common bad advice)

- **Do not** add SPA-style rewrites like `"source": "/(.*)", "destination": "/index.html"`. That pattern is for **static** single-page apps. **Next.js** already has server-side routes; those rewrites break App Router and API routes.
- **Do not** set a custom **Output Directory** for a standard Next.js deploy unless you know you need it (e.g. `output: 'export'`). Wrong output = 404 everywhere.

## In Vercel → Project → Settings → General

| Setting | Expected |
|---------|----------|
| **Root Directory** | `auction-app` |
| **Framework Preset** | **Next.js** (auto-detected after root is set) |

## In Vercel → Settings → Build & Development Settings

Open **Build & Development Settings** and check **overrides**:

| Override | Expected |
|----------|----------|
| **Build Command** | Empty (default) **or** `npm run build` — must run **inside** `auction-app` |
| **Install Command** | Empty (default) **or** `npm install` |
| **Output Directory** | **Empty** — leave blank. If you see `dist`, `out`, `build`, `.next` as a **custom** output for “static hosting”, **clear it**. Next.js on Vercel serves from its own build output; overriding this is a frequent cause of 404s. |

## Probes after deploy

1. **Static file (no server logic):**  
   `https://YOUR_PROJECT.vercel.app/health.txt`  
   Should return plain text `ok`. If this **404**s, Vercel is not serving the Next `public/` folder → output / framework / root misconfiguration.

2. **API route:**  
   `https://YOUR_PROJECT.vercel.app/api/health`  
   Should return JSON. If **health.txt** works but this **404**s, say so (different class of bug).

3. **Home:**  
   `https://YOUR_PROJECT.vercel.app/`

## “Include files outside the root directory”

Usually **on** is fine for monorepos. If nothing else works, try turning it **off** once and redeploy (your app is self-contained under `auction-app`).

## New Vercel project?

You can create a **new** project from the same GitHub repo and set **Root Directory** to `auction-app` from the start. That clears bad overrides. You do **not** need to delete the old project first, but deleting avoids confusion about which URL to use.

## Permissions / URL

- Use the **Production** domain from **Domains** (or the deployment’s **Visit** link).
- **Deployment Protection** (password / Vercel login) usually shows a **login** screen, not a generic 404 — but verify you’re not using an old Preview URL.
