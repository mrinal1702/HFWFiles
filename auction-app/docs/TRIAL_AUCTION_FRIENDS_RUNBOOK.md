# Trial auction with friends — runbook

**Save as Word:** In Microsoft Word, use **File → Open** and choose this file (`TRIAL_AUCTION_FRIENDS_RUNBOOK.md`), then **File → Save As → Word Document (.docx)** if you want a native `.docx` copy.

---

Step-by-step reference for running a **real** auction test: you (commissioner) prepare Supabase and the app; friends **sign up, join with a code, then bid** in the web UI.

**Related docs:** `TESTING_OPERATIONS.md` (reset / stack / seed), `BIDDING_SYSTEM_AND_UI_HANDOFF.md` (bidding rules).  
**Security note:** This runbook matches the **current** app (service role on the server, no “bidding start time” gate yet). Tighten access and rules before a public launch.

---

## One-time prerequisites (you, before anyone plays)

These should already be true if you ran the SQL in order: `auction-bidding.sql` → `auth-and-join.sql` → (optional) reset / stack / seed helpers.

1. **Supabase project**
   - **Authentication → Providers → Email** enabled.
   - For the smoothest trial: **disable “Confirm email”** (so friends get a session immediately after sign-up). You can turn confirmation on later.
   - **Minimum password length** set to **6** (or stricter if you prefer).

2. **Database**
   - `profiles`, `Auctions.join_code`, `Auctions.max_participants`, `auction_users.user_id` exist (from `scripts/sql/auth-and-join.sql`).
   - `public.players` populated (global player pool).
   - For the auction you will use: **`auction_lots` seeded** for that `auction_id` (one row per player in the pool). Use `seed_auction_lots_for_auction` or your existing seed scripts.

3. **Next.js app (`auction-app`)**
   - `.env.local` includes at least:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY` (server-side loads and actions)
   - Run locally: `npm run dev`, or deploy with the same env vars.
   - Friends need the **URL** you give them (e.g. `https://your-host` or `http://YOUR_LAN_IP:3000` on your Wi‑Fi).

4. **Participant cap**
   - Each auction allows up to **`max_participants`** (default **12**).
   - **Every row** in `auction_users` for that auction counts, including **legacy test managers** with `user_id` NULL. If you still have dummy rows, they **consume seats** until you remove them or use a fresh auction with **no** dummy users (see §3).

---

## What you do vs what friends do (summary)

| Phase | You (commissioner) | Each friend |
|--------|---------------------|-------------|
| **Before** | Supabase + env + create auction + join code + seeded lots + share URL + code | — |
| **Onboard** | (Optional) sign up yourself and join the same auction | Sign up → log in → **Dashboard** → enter join code → lands in bidding room |
| **Play** | Same as friends if you joined | Open **Bidding room**, place bids; use **Refresh** after fast action |

---

## 1) Create an auction friends can join

You need a row in **`Auctions`** with:

- `hard_deadline_at` set (global end of bidding; required by `place_bid`).
- `join_code` set (unique, **uppercase** 6–8 characters is typical; the app stores/compares uppercase).
- `max_participants` = **12** (or lower if you want a smaller league).
- `is_active` = **true** (unless you intentionally pause).

**Important:** After the auction exists, **seed lots** for that `auction_id`:

```sql
select public.seed_auction_lots_for_auction(<your_auction_id>);
```

### Option A — Clean auction with **no** dummy managers (best for 12 real humans)

Use the SQL editor (adjust name, deadline, and omit `id` if your table uses a default/sequence):

```sql
insert into public."Auctions" (name, is_active, hard_deadline_at, join_code, max_participants)
values (
  'Friends trial auction',
  true,
  (timestamp '2026-06-15 20:00:00' at time zone 'UTC'),
  upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  12
)
returning id, join_code;
```

Copy the returned **`join_code`** and **`id`**, then:

```sql
select public.seed_auction_lots_for_auction(<id_from_above>);
```

Verify in **Table Editor**: `auction_lots` has many rows for that `auction_id`.

### Option B — Use `create_stacked_test_auction` (creates **test** managers)

`npm run stack:auction -- "name" "<ISO deadline>" 8 350` (or the SQL equivalent) creates an auction **and** N **`auction_users` rows without `user_id`**. Those rows **count toward 12**. Either:

- Accept fewer friend slots (`12 − N`), or  
- **Delete** dummy rows before the trial, e.g.:

```sql
delete from public.auction_users
where auction_id = <auction_id> and user_id is null;
```

(Only do this if you are sure you do not need those test managers for anything else.)

### Option C — Reuse your current trial auction

- In **Supabase**, open **`Auctions`**, find the row, copy **`join_code`** (if null, set a new unique code).
- Ensure **`hard_deadline_at`** is in the future.
- Ensure **`auction_lots`** exist for that auction.
- **Count seats:** `auction_users` for that `auction_id` must stay **≤ max_participants** after everyone joins.

---

## 2) Tell friends what to do (copy-paste checklist)

Send them:

1. **App link** — exact URL to your running app (include `http://` or `https://`).
2. **Join code** — the `join_code` value (letters/numbers; they can type with or without spaces; the app normalizes).
3. **Steps:**
   - Open the link → **Sign up** (display name, email, password ≥ 6 characters).
   - **Log in** if needed.
   - Open **Dashboard**.
   - Under **Join auction**, enter the code → **Join auction**.
   - You should land in the **Bidding room** for that league.
4. **Bidding**
   - Use the tabs (**All players**, **Ongoing bids**, **Unsold**, **Sold**) and filters as needed.
   - Enter a **whole number** bid on a row → **Bid**.
   - If something looks wrong after a fast bid war, click **Refresh** (or refresh the browser). The **database** is always right if the UI is stale.
5. **Rules (short)** — opening bid **≥ 5**, integers only, roster/cap and budget rules enforced by the server (see handoff doc if they want detail).

---

## 3) What you should verify before saying “go”

- [ ] `hard_deadline_at` is set and **in the future** for that auction.
- [ ] `join_code` is set and you have communicated it correctly (no typo; compare to Table Editor).
- [ ] `seed_auction_lots_for_auction` has been run for that `auction_id`.
- [ ] Seat math: `count(auction_users where auction_id = X) + (number of friends about to join) ≤ max_participants`.
- [ ] You can open **Dashboard** yourself, join with the same code (if you want to bid), and open **Bidding room** without errors.
- [ ] Friends can reach the app (firewall / VPN / localhost: only works on your machine unless you use tunneling or LAN IP).

---

## 4) Common failures and quick fixes

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| “No auction found for that code” | Wrong code, or code not set | Check `Auctions.join_code` in Supabase; codes are compared **uppercase**. |
| “This auction is full.” | 12 (or max) seats used | Remove legacy `auction_users` with `user_id` null, raise `max_participants` (not recommended above 12 without product change), or new auction. |
| “You are already part of this auction.” | They joined twice | They should use **Dashboard → Your auctions** to open the league. |
| “You are not a member of that auction” | Direct URL without joining | Join from **Dashboard** with the code first. |
| Sign up works but immediate log-out / redirect loop | **Email confirmation** required | Disable confirm email for the trial, or friends must click the email link first. |
| No players / empty lots | Lots not seeded | Run `seed_auction_lots_for_auction(auction_id)`. |
| All bids rejected / deadline | Past `hard_deadline_at` | Extend deadline in `Auctions` for the trial. |
| “Missing … KEY” / blank pages | Env vars | Fix `.env.local` and restart `npm run dev`. |

---

## 5) After the trial (optional housekeeping)

- **Reset** a dev environment: see `TESTING_OPERATIONS.md` (`reset:testing`, `replace:auction-users`, etc.).
- **Do not** expose the **service role** key in the browser or in a public repo.
- Later you can add: official “bidding opens at” time, self-serve **Create auction**, email verification, and stricter RLS — not required for this runbook.

---

## 6) Quick reference — URLs in the app

| URL | Who |
|-----|-----|
| `/` | Landing; links to log in / sign up / dashboard |
| `/signup`, `/login` | Account |
| `/dashboard` | Join code + **your** auctions only |
| `/auctions/<id>/bidding-room` | Main bidding UI (after join) |
| `/auction-lab` | Integration / dev tool (not the main friend-facing flow) |

---

*Last aligned with `auction-app` auth + join flow and bidding schema as documented in-repo.*
