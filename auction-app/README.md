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

- **[docs/BIDDING_SYSTEM_AND_UI_HANDOFF.md](./docs/BIDDING_SYSTEM_AND_UI_HANDOFF.md)** — schema, RPCs, rules, and **handoff for the bidding UI** (read this before building the user-facing auction front end).
- **[docs/TESTING_OPERATIONS.md](./docs/TESTING_OPERATIONS.md)** — reset DB, seed lots, stack extra auctions, replace test users.
- **Auth & join:** run `scripts/sql/auth-and-join.sql` in Supabase after `auction-bidding.sql`, **before** `reset-testing-environment.sql` / `testing-auction-helpers.sql` (those inserts expect `join_code` + `max_participants`). Use **Dashboard** (`/dashboard`) to sign up, join by code, and open auctions. Optional: `ADMIN_EMAIL` in `.env.local` (reserved for future commissioner tools).
- **Friends trial:** **[docs/TRIAL_AUCTION_FRIENDS_RUNBOOK.md](./docs/TRIAL_AUCTION_FRIENDS_RUNBOOK.md)** — commissioner vs player steps, join codes, seat limits, troubleshooting (open in Word and Save As `.docx` if you want).

Dev integration page: [http://localhost:3000/auction-lab](http://localhost:3000/auction-lab) (service role on server; not for public production without protection).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
