This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Fantasy auction (bidding engine)

- **[docs/USER_UI_AND_DEPLOYMENT.md](./docs/USER_UI_AND_DEPLOYMENT.md)** — **current user interface** (routes, bidding room, default sort, theme), **deployment** summary, and links to the full Vercel playbook in the repo root.
- **[docs/BIDDING_SYSTEM_AND_UI_HANDOFF.md](./docs/BIDDING_SYSTEM_AND_UI_HANDOFF.md)** — schema, RPCs, rules, and technical handoff for the bidding stack (read with the UI doc above).
- **[docs/TESTING_OPERATIONS.md](./docs/TESTING_OPERATIONS.md)** — reset DB, seed lots, stack extra auctions, replace test users.
- **Auth & join:** run `scripts/sql/auth-and-join.sql` in Supabase after `auction-bidding.sql`, **before** `reset-testing-environment.sql` / `testing-auction-helpers.sql` (those inserts expect `join_code` + `max_participants`). Use **Dashboard** (`/dashboard`) to sign up, join by code, and open auctions. Optional: `ADMIN_EMAIL` in `.env.local` (reserved for future commissioner tools).
- **Friends trial:** **[docs/TRIAL_AUCTION_FRIENDS_RUNBOOK.md](./docs/TRIAL_AUCTION_FRIENDS_RUNBOOK.md)** — commissioner vs player steps, join codes, seat limits, troubleshooting (open in Word and Save As `.docx` if you want).

Dev integration page: [http://localhost:3000/auction-lab](http://localhost:3000/auction-lab) (service role on server; not linked from normal app nav; not for public production without protection).

You can start editing the landing page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Deploy on Vercel (this monorepo)

This folder is **`auction-app`** inside a larger repo. **Do not** point Vercel at the repository root.

1. **Root Directory** in Vercel project settings must be **`auction-app`** (see repo root **`README.md`**).
2. Full checklist: **`docs/USER_UI_AND_DEPLOYMENT.md`** (summary) and repo **`docs/VERCEL_DEPLOYMENT_PLAYBOOK.md`** (detailed).
3. Env vars: **`docs/GIT_AND_VERCEL.md`**.

## Learn More (Next.js)

- [Next.js Documentation](https://nextjs.org/docs)
- [Deploying Next.js](https://nextjs.org/docs/app/building-your-application/deploying)
