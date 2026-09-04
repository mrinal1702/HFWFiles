# HFW WC Fantasy Auction 3 Online — setup runbook

**Auction name:** `HFW WC Fantasy Auction 3 Online`  
**Target id:** `7` (Auction 1 = id 5, Auction 2 = id 6)  
**Source CSV:** `Auction 3/Auction_3_Teams.csv`

This creates a **brand-new** auction. Auctions 5 and 6 are **never modified**.

---

## Phase 1 — Squads & budgets (now)

### Already done (by tooling / validation)

| Step | Status |
|------|--------|
| CSV parsed — 10 participants, 177 squad rows | Done (dry run) |
| All `fotmob_player_id` values exist in `public.players` | Done |
| Import script written: `scripts/setup-auction-from-squads-csv.mjs` | Done |
| Confirmed auction id **7 is free** in Supabase | Done |
| Auctions 5 & 6 unchanged | Done |

### You still need to do

#### 1. Run the import (creates auction id 7 only)

```bash
cd auction-app
npm run setup:auction-squads -- --auction-id 7
```

Optional explicit name (default is already correct):

```bash
npm run setup:auction-squads -- --auction-id 7 --name "HFW WC Fantasy Auction 3 Online"
```

This inserts **only** into auction id 7:

- `Auctions` row (name, join_code, placeholder deadline 2099)
- 10 × `auction_users` (names from CSV, `user_id` = null for now)
- 177 × `auction_teams` (player + purchase price)
- `auction_lots` seeded; owned players marked **`sold`**
- Placeholder budgets: `350 − CSV spend` (many will be wrong — fix next step)

#### 2. Set correct budgets (Supabase SQL Editor)

Review current state:

```sql
select
  u.id,
  u.name,
  u.budget_remaining,
  u.active_budget,
  count(t.player_id) as squad_size,
  coalesce(sum(t.purchase_price), 0) as csv_squad_spend
from public.auction_users u
left join public.auction_teams t
  on t.auction_user_id = u.id and t.auction_id = u.auction_id
where u.auction_id = 7
group by u.id, u.name, u.budget_remaining, u.active_budget
order by u.name;
```

Set each manager’s **true** remaining budget (both columns must match when no open bids):

```sql
update public.auction_users
set budget_remaining = <amount>, active_budget = <amount>
where auction_id = 7 and name = 'Agastya';
-- repeat for Akshan, AZ/Dalla, Devarya, E/M, Gappu, Sharuya/Armaan, Udani, V/K, ZB
```

#### 3. Link website accounts to pre-loaded rows

**Important:** Do **not** ask owners to use the join code. Joining creates a **second** empty row.

List registered users:

```sql
select p.id as auth_user_id, p.display_name, u.email
from public.profiles p
join auth.users u on u.id = p.id
order by p.display_name;
```

Link each auth user to their squad row:

```sql
update public.auction_users
set user_id = '<auth_user_uuid>'
where auction_id = 7 and name = 'Agastya';
```

Verify:

```sql
select id, name, user_id, budget_remaining, active_budget
from public.auction_users
where auction_id = 7
order by name;
```

Owners can then open **`/auctions/7/bidding-room`** or **`/auctions/7/team`** while logged in.

#### 4. Spot-check squads in the app

- Log in as one owner (or use commissioner view)
- Open **Team** page — 17–18 players, correct prices
- **Sold** tab in bidding room — CSV-owned players should appear sold
- **Unsold** tab — remaining pool players available for future bids

---

## Phase 2 — Game week & bidding (later)

Not needed until squads/budgets/auth links are correct.

- Set `initiation_deadline_at`, `raise_deadline_at`, `hard_deadline_at` on `"Auctions"` id 7
- Activate / configure `Game_Weeks`
- Lock gameweek squads per `GAMEWEEK_FLOW.md`

---

## Participant names (CSV → `auction_users.name`)

| CSV name | Notes |
|----------|--------|
| Agastya | 18 players |
| Akshan | 18 |
| AZ/Dalla | shared team |
| Devarya | 18 |
| E/M | shared team |
| Gappu | 17 (live changes) |
| Sharuya/Armaan | shared team, 17 players |
| Udani | 17 |
| V/K | shared team |
| ZB | 18 |

---

## Re-import (auction 7 only)

Wipes **only** auction 7 data and reloads from CSV:

```bash
npm run setup:auction-squads -- --auction-id 7 --reset
```

Then repeat budget + `user_id` linking.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Missing player ids | `npm run import:players` |
| Duplicate manager after join code | Delete the extra `auction_users` row; link `user_id` on the original row instead |
| User sees “not in this auction” | `user_id` not set on their row |
| Wrong budget on bids | Update both `budget_remaining` and `active_budget` |
