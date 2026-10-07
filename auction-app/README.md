This is the HFW Auction App — a fantasy football auction platform for a private group.

**For agents / new contributors, start with these three:**
- [`docs/AGENT_HANDOFF.md`](./docs/AGENT_HANDOFF.md) — product orientation, tech stack, conventions, and current state.
- [`docs/OPS_INDEX.md`](./docs/OPS_INDEX.md) — day-to-day ops (bidding, locks, scoring, relegations, UI standards).
- [`scripts/sql/README.md`](./scripts/sql/README.md) — the canonical database schema index (tables, views, RPCs → SQL file).

---

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

- **[CLAUDE.md](./CLAUDE.md)** — map of this app (pages, lib, scripts, docs) for agents.
- **[docs/ui-contracts/](./docs/ui-contracts/)** — frozen participant UI (`AUCTION_PAGES.md`, `LEADERBOARD.md`).
- **[docs/OPS_INDEX.md](./docs/OPS_INDEX.md)** — ops handbook; schema index in **[scripts/sql/README.md](./scripts/sql/README.md)**.
- **[docs/TESTING_OPERATIONS.md](./docs/TESTING_OPERATIONS.md)** — reset DB, seed lots, stack extra auctions, replace test users.
- **Auth & join:** run `scripts/sql/auth-and-join.sql` in Supabase after `auction-bidding.sql`, **before** `reset-testing-environment.sql` / `testing-auction-helpers.sql` (those inserts expect `join_code` + `max_participants`). Use **Dashboard** (`/dashboard`) to sign up, join by code, and open auctions. Optional: `ADMIN_EMAIL` in `.env.local` (reserved for future commissioner tools).
- **Friends trial:** **[docs/TRIAL_AUCTION_FRIENDS_RUNBOOK.md](./docs/TRIAL_AUCTION_FRIENDS_RUNBOOK.md)** — commissioner vs player steps, join codes, seat limits, troubleshooting (open in Word and Save As `.docx` if you want).

Dev integration page: [http://localhost:3000/auction-lab](http://localhost:3000/auction-lab) (service role on server; not linked from normal app nav; not for public production without protection).

You can start editing the landing page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Deploy on Vercel (this monorepo)

This folder is **`auction-app`** inside a larger repo. **Do not** point Vercel at the repository root.

1. **Root Directory** in Vercel project settings must be **`auction-app`** (see repo root **`README.md`**).
2. Full checklist: repo **`docs/VERCEL_DEPLOYMENT_PLAYBOOK.md`**.
3. Env vars: **`docs/GIT_AND_VERCEL.md`**.

## Learn More (Next.js)

- [Next.js Documentation](https://nextjs.org/docs)
- [Deploying Next.js](https://nextjs.org/docs/app/building-your-application/deploying)
