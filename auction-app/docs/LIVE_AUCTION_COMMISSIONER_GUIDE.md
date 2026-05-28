# Live Auction — Commissioner's Guide

This document is for **Mrinal (the auction admin/commissioner)**. It covers everything needed to set up and run a live auction — from getting participants signed up to handling issues on the day. No coding knowledge required; everything here is either clicking in the app or running a SQL query in Supabase.

**App URL:** https://hfwauction.vercel.app
**Supabase Dashboard:** https://supabase.com/dashboard/project/ealowpaiiwsrbwucgkng

---

## Before the Auction — Setup Checklist

### 1. Supabase auth settings (one-time)

Turn off email confirmation so participants can sign up and use the app immediately:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/ealowpaiiwsrbwucgkng)
2. Left sidebar → **Authentication** → **Providers**
3. Find **Email** → toggle off **"Confirm email"**
4. Save

### 2. Tell participants to sign up

Send everyone this message (adjust as needed):

> Go to **hfwauction.vercel.app**, click **Sign up**, and create an account with your name and email. Do this before [date]. Once you're done, let me know your email address and I'll add you to the auction.

They don't need to do anything else after signing up — no join code, no extra steps.

### 3. Create the live auction in Supabase

In Supabase → **Table Editor** → `live_auctions` → **Insert row**:

| Column | Value |
|--------|-------|
| `name` | e.g. `HFW World Cup 2026` |
| `status` | `setup` (change to `live` on auction day) |
| `starting_budget` | `350` (or whatever budget per person) |
| `squad_size` | `18` (or your squad size) |
| `min_bid` | `5` |
| `created_by` | your user UUID (`785ab229-1c9e-4208-b20f-76506968d4be`) |

Save and copy the auto-generated `id` (UUID) — you'll need it for the next steps.

### 4. Seed the player pool

Once the `players` table has been updated with World Cup national team squads, run this in a terminal (from the `auction-app` folder):

```bash
node scripts/seed-live-auction-players.mjs \
  --auction-id <your-new-auction-uuid> \
  --teams "England,Brazil,Argentina,France,Germany,Spain,Portugal,Netherlands"
```

Adjust the team names to match exactly what's in the `players` table. Use `--dry-run` first to preview without writing anything.

### 5. Add yourself as admin participant

In Supabase SQL Editor:

```sql
INSERT INTO live_auction_participants (auction_id, user_id, display_name, role)
VALUES (
  '<your-new-auction-uuid>',
  '785ab229-1c9e-4208-b20f-76506968d4be',
  'Mrinal',
  'admin'
);
```

This gives you both admin access (recording sales) and participant status (your own team and budget).

### 6. Add other participants

For each person who has signed up, find their UUID and run:

```sql
INSERT INTO live_auction_participants (auction_id, user_id, display_name, role)
VALUES (
  '<your-new-auction-uuid>',
  '<their-user-uuid>',
  'Their Display Name',
  'participant'
);
```

**How to find someone's UUID:**
Supabase Dashboard → **Authentication** → **Users** → search by email → copy the UUID in the `id` column.

You can run multiple inserts at once by repeating the VALUES rows:

```sql
INSERT INTO live_auction_participants (auction_id, user_id, display_name, role)
VALUES
  ('<auction-uuid>', '<uuid-1>', 'Alice', 'participant'),
  ('<auction-uuid>', '<uuid-2>', 'Bob', 'participant'),
  ('<auction-uuid>', '<uuid-3>', 'Charlie', 'participant');
```

### 7. Set auction status to Live

On auction day, update the status in Supabase SQL Editor:

```sql
UPDATE live_auctions
SET status = 'live'
WHERE id = '<your-auction-uuid>';
```

Or do it directly in the Table Editor.

---

## On Auction Day — Admin Workflow

### Where to go

Open two browser tabs:
- **Admin page:** `hfwauction.vercel.app/live-auction/<auction-id>/admin`
- **Overview page:** `hfwauction.vercel.app/live-auction/<auction-id>` (optional — to see the live state as participants see it)

### Recording a sale

You have two modes on the admin page — toggle between them at the top of the "Record a Sale" card:

**Search player (default)**
Best for: finding a specific player quickly, especially unsold players from earlier rounds.
1. Type the player's name or team in the search box
2. Select them from the dropdown
3. Select the buyer from the participant dropdown
4. Enter the sale price
5. Click **Confirm Sale**

**Browse by team**
Best for: going through a team's players in order during the auction.
1. Select the team from the dropdown
2. The full player list appears
3. For each available player (shown with Owner + £ inputs): select the buyer, enter the price, click **Sell**
4. Sold players show as greyed-out ✓ Sold rows — click **Edit** if you need to change them

### Budget warning

If a sale would leave someone with less budget than they'd need to fill their remaining squad slots, you'll see an amber warning box. Tick **"Proceed anyway"** if it's intentional (e.g. they're happy to end with a shorter squad). This is just advisory — you decide.

### Voiding a sale (wrong price or wrong buyer entered)

In the **Recent Sales** log at the bottom of the admin page:
1. Find the sale in the list
2. Click **Void** → enter an optional reason → **Confirm void**

The player returns to the available pool and the buyer's budget is restored.

### Editing a sale (price or buyer needs changing)

In the **Recent Sales** log:
1. Find the sale → click **Edit**
2. Change the price and/or participant → **Save changes**

The budget check runs again with the new values. If the new price exceeds the buyer's budget, the edit is rejected.

---

## What Participants See

Once added to the auction, participants go to:
`hfwauction.vercel.app/live-auction/<auction-id>`

They see three tabs:

**My Team**
Their own squad so far. Players grouped by position (GK → DEF → MID → FWD), sorted highest price first. Budget bar shows how much they've spent. Slots remaining shown at the top.

**All Teams**
Summary cards for every participant, including yours. Each card shows: budget bar, and a breakdown like `1 GK · 3 DEF · 4 MID · 2 FWD`. Clicking a card takes them to that person's full squad.

**Unsold Players**
Every player not yet sold, grouped by team. Sorted alphabetically within each team. Participants use this to plan their remaining budget.

**Refresh button**
Participants must click this to see the latest sales. There is no automatic refresh — clicking Refresh pulls the latest data from the server.

---

## Common Issues and Fixes

### "Admin link takes me back to the overview page"

This means the admin check failed. Likely cause: your `user_id` in `live_auction_participants` doesn't match your Supabase auth UUID. Fix:

```sql
UPDATE live_auction_participants
SET user_id = '785ab229-1c9e-4208-b20f-76506968d4be'
WHERE auction_id = '<auction-uuid>'
  AND role = 'admin';
```

### "A participant can't log in / forgot their password"

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Find their email → click the **⋮ menu** on the right → **Send password reset email**
3. They get a link in their inbox to set a new password

### "I added the wrong participant to a sale"

Use the **Edit** button in the Recent Sales log to change the participant. The budget check will re-run with the correct person.

### "A player was sold at the wrong price"

Use the **Edit** button in the Recent Sales log to correct the price. If the new price exceeds the buyer's remaining budget, the edit is rejected.

### "A sale was recorded that shouldn't have happened"

Use the **Void** button in the Recent Sales log. The player returns to available and the budget is restored.

### "A participant's budget looks wrong"

Budgets are always computed live from non-voided sales. If something looks off, check the Recent Sales log for any sales that should be voided. There is no separate budget field to fix.

### "The player list is empty / no players in the pool"

The player pool hasn't been seeded for this auction. Run the seed script (see setup step 4 above).

### "Supabase project is not responding"

The free tier pauses after inactivity. A GitHub Actions workflow pings it every 12 hours to prevent this. If it's paused, simply visiting any page on the app will wake it — wait 30 seconds and try again.

---

## After the Auction

### Mark auction as completed

```sql
UPDATE live_auctions
SET status = 'completed'
WHERE id = '<auction-uuid>';
```

### What the data looks like

All sales are in `live_auction_sales`. Each row has: `player_id`, `participant_id`, `price`, `is_voided`. Non-voided sales are the final squads. This data can be used later to import squads into the scoring pipeline.

### Viewing final squads

Any participant can view their own or others' squads at:
`hfwauction.vercel.app/live-auction/<auction-id>/team/<participant-id>`

Or via the **All Teams** tab on the overview page.

---

## Key IDs to Keep Handy

| Thing | Value |
|-------|-------|
| App URL | https://hfwauction.vercel.app |
| Supabase project | https://supabase.com/dashboard/project/ealowpaiiwsrbwucgkng |
| Your Supabase user UUID | `785ab229-1c9e-4208-b20f-76506968d4be` |
| Test auction ID | `e4223881-987b-483b-9681-817d47b0b94a` |
