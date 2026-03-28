# Vercel shows “404 NOT FOUND” — troubleshooting

Use this when the build is green but the live URL returns **404** for `/` or every path.

## 1) Root directory (most common)

This repo’s Next.js app is in **`auction-app/`**. The repository **root** has **no** `package.json`.

| Wrong | Right |
|--------|--------|
| Root Directory = *(empty)* or `/` | Root Directory = **`auction-app`** |

**Fix:** Vercel → Project → **Settings** → **General** → **Root Directory** → enter **`auction-app`** → Save → **Redeploy**.

**Verify after deploy:**

- Open `https://YOUR_PROJECT.vercel.app/api/health`  
  - **200** with JSON `{ "ok": true, ... }` → Next.js is deployed correctly.  
  - **404** → Vercel is still not serving this app (wrong root, wrong project, or wrong deployment).

- Open `https://YOUR_PROJECT.vercel.app/`  
  - Should show the home page, not a generic 404.

## 2) Confirm you’re on the right project and URL

- Use the **Production** domain from **Vercel → Project → Domains** (e.g. `something.vercel.app`).
- If you have multiple Vercel projects, make sure the one linked to **this** GitHub repo is the one you’re opening.

## 3) Framework / build settings

- **Framework preset** should be **Next.js** (auto-detected when Root Directory is `auction-app`).
- Do **not** set **Output Directory** manually for Next.js (leave default). Overriding it to something like `dist` or `.next` incorrectly often causes broken or empty sites.

## 4) Environment variables (usually 500, not 404)

Missing `NEXT_PUBLIC_SUPABASE_*` or `SUPABASE_SERVICE_ROLE_KEY` typically causes **runtime errors** or **500**s on pages that call the database — **not** a plain 404 on `/`.

Still set these in Vercel → **Settings** → **Environment Variables** for **Production** (and **Preview** if you use preview deploys):

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — never commit to Git; paste in Vercel UI only |

**You do not put these in Git.** You do not need a special “Git API key” for Vercel: connect GitHub to Vercel with normal OAuth; the Supabase keys are separate and only go in **Vercel env** (and local `.env.local`).

## 5) Build logs

- **Deployments** → select the deployment → **Building** / **Build Logs**.  
- Confirm it runs `npm install` and `next build` **inside** `auction-app` (paths in the log should mention `auction-app`).

## 6) Middleware

This app uses Next.js **middleware** for auth. It does **not** block `/`. If `/api/health` works but `/` fails, say so when asking for help (that would be unusual).

## Quick checklist

- [ ] Root Directory = **`auction-app`**
- [ ] Redeploy after changing Root Directory
- [ ] `/api/health` returns **200** JSON
- [ ] Supabase env vars set on Vercel (for real auth/data, not for fixing a pure 404)
- [ ] Opening the exact **Production** URL from the Vercel dashboard
