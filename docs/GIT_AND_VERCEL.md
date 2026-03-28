# Git push and Vercel deploy (HFW monorepo)

The Git repository root is **`HFWFiles`** (parent of `auction-app`). The Next.js app lives in **`auction-app/`**.

## What was set up locally

- `git init` at repo root, branch **`main`**
- Root **`.gitignore`** ignores `.env*` files, `node_modules`, `.next`, `__pycache__`, etc. **Do not commit** `.env.local` — it contains secrets.
- Removed nested **`auction-app/.git`** so the whole app is tracked in the monorepo (not a submodule).

## Push to GitHub (you run these)

1. Create a new repository on GitHub (**empty**, no README if you want a clean history), e.g. `HFWFiles` or `hfw-auction`.

2. In PowerShell:

```powershell
cd C:\Users\trive\HFWFiles
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

If GitHub asks for login, use a **Personal Access Token** as the password (GitHub → Settings → Developer settings → Personal access tokens), or use **GitHub CLI** (`gh auth login`) / **Git Credential Manager**.

3. After the first push, teammates clone with:

```bash
git clone https://github.com/YOUR_USER/YOUR_REPO.git
```

## Vercel

1. Import the **same GitHub repo** in [Vercel](https://vercel.com).

2. **Root Directory:** set to **`auction-app`** (Project Settings → General → Root Directory).  
   Vercel must run `npm install` and `next build` **inside** `auction-app`.

3. **Environment variables** (Project → Settings → Environment Variables), for Production (and Preview if you want):

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service_role** secret (server only; never expose in client code) |

   Optional: `ADMIN_EMAIL` (reserved for future use).

4. Redeploy after changing env vars.

## Security reminder

The **service role** key bypasses RLS. Your app uses it on the server for bidding and joins. Keep the repo **private** or audit what you expose; rotate the key if it ever leaks.

## Updating the site after changes

```powershell
cd C:\Users\trive\HFWFiles
git add -A
git commit -m "Describe your change"
git push
```

Vercel will build and deploy from the new commit automatically if the project is connected to the repo.
