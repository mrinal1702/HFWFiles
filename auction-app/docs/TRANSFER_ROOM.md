# Transfer Room

Peer-to-peer player and cash transfers between auction participants. Transfers live entirely within the online auction — the live auction has no involvement.

---

## Transfer Window

The transfer window is a manual on/off switch controlled by the commissioner. It is independent of the bidding hard deadline, but the hard deadline always forces it closed.

### Opening the window
```sql
UPDATE "Auctions" SET transfer_window_open = true WHERE id = <auction_id>;
```

### Closing the window (manual)
```sql
UPDATE "Auctions" SET transfer_window_open = false WHERE id = <auction_id>;
```

### Automatic closure
`void_expired_transfers` fires when any participant visits the Transfer Room page after the auction's `hard_deadline_at` has passed. It:
1. Cancels every in-flight transfer (any non-terminal status)
2. Releases all cash holds back to participants
3. Sets `transfer_window_open = false`

The window must be **manually re-opened** before the next transfer period begins. There is no UI toggle — use the SQL command above.

### What participants see when closed
When the window is closed, the Transfer Room tab shows a "Transfer Window Closed" screen and nothing else. No active transfers, no history, no propose button.

---

## The 4-Stage Transfer Flow

```
Stage 1  PROPOSE        Proposer sends offer (players + cash)
           ↓
         awaiting_response

Stage 2  RESPOND        Recipient counter-offers (their players + cash)
           ↓
         awaiting_confirmation    ← cash holds placed for both parties here

Stage 3  CONFIRM        Both parties independently confirm (any order)
           ↓ (both confirmed)
         completed  ─── (if transfers_require_admin_approval = true, or cash-only deal)
                                  ↓
                            pending_admin

Stage 4  EXECUTE        Transfer executes atomically:
                        - Players move between auction_teams rows
                        - Budgets settled (budget_remaining + active_budget)
                        - Transfer marked completed with plain-English summary
```

### Status reference

| Status | Meaning |
|---|---|
| `awaiting_response` | Recipient has not yet responded |
| `awaiting_confirmation` | Both sides defined; each must confirm |
| `pending_admin` | Both confirmed; awaiting commissioner approval |
| `completed` | Executed — squads and budgets updated |
| `rejected` | Recipient (or admin) rejected |
| `cancelled` | Proposer cancelled, or voided at hard deadline |

### Who can do what

| Action | Who |
|---|---|
| Propose | Any participant (window must be open) |
| Respond | Recipient only, while `awaiting_response` |
| Confirm | Either participant, once each, while `awaiting_confirmation` |
| Cancel | Proposer only, any active (non-terminal) status |
| Reject | Recipient only, any active (non-terminal) status |
| Admin approve / reject | Commissioner only, while `pending_admin` |

---

## Rules and Constraints

### Players
- A participant can only offer players they **own outright** (present in `auction_teams`). A player you are the current highest bidder on but have not yet won cannot be transferred.
- A player already in an active transfer is locked and cannot be added to another.
- Max squad size of 18 and max 1 goalkeeper per team are enforced at execution. The transfer is rejected if either party would breach these limits.

### Budget
- Only `active_budget` (total budget minus live bid holds) is checked — not `budget_remaining`.
- Cash holds are placed on **both parties** at the `respond_to_transfer` stage, reducing their `active_budget`. This prevents the held cash from being spent on bids while the deal is in flight.
- A participant whose `active_budget < cash_they_are_sending` will fail at the respond stage (`proposer_insufficient_funds` / `recipient_insufficient_funds`). It is the participant's responsibility to ensure they have enough active budget — freeing up budget means withdrawing bids or completing other transfers first.
- No participant can have a negative `budget_remaining` or `active_budget` at any point.

### Cash-only transfers
- Both parties must offer something — a pure one-sided cash gift is not possible.
- Cash-only deals (no players on either side) **always** go through `pending_admin` for commissioner approval, regardless of the `transfers_require_admin_approval` setting.

### Budget settlement on execution

| Party | `budget_remaining` | `active_budget` |
|---|---|---|
| Proposer | `− proposer_cash + recipient_cash` | `+ recipient_cash` (hold already deducted) |
| Recipient | `− recipient_cash + proposer_cash` | `+ proposer_cash` (hold already deducted) |

For player-only swaps (no cash), both budget columns are unchanged.

---

## Hub Page Layout (`/auctions/[id]/transfers`)

When the window is open, transfers are split into three sections:

1. **Needs your action** — transfers where you must act next:
   - Incoming proposals (`awaiting_response`, you are recipient)
   - Deals awaiting your confirmation (`awaiting_confirmation`, you haven't confirmed yet)
   - Pending admin queue (commissioner only)

2. **Awaiting their response** — transfers where you are waiting:
   - Your outgoing proposals
   - Deals where you've confirmed but the other party hasn't

3. **Transfer history** — completed, rejected, and cancelled transfers (your own; admin sees all)

---

## Propose Flow (`/auctions/[id]/transfers/new`)

Two-step client-side UI, no extra page loads:

1. **Manager picker** — grid of all other participants showing name, squad size, total budget, available budget
2. **Deal builder** — side-by-side view:
   - Left: your squad (checkable) + cash input
   - Right: their squad (reference only — they pick their side when they respond)
   - Live proposal summary before submit

Only the proposer's side (player IDs + cash) is sent at this stage. The recipient's side is empty until they respond.

## Respond Flow (`/auctions/[id]/transfers/[id]/respond`)

Side-by-side view:
- Left: proposer's offer (read-only, highlighted)
- Right: recipient's squad (checkable) + cash input + live deal summary

---

## Admin Controls

### Require approval for all transfers
```sql
UPDATE "Auctions" SET transfers_require_admin_approval = true WHERE id = <auction_id>;
```
When enabled, every transfer (including player exchanges) routes through `pending_admin` after both parties confirm. Default is `false` — player exchanges execute automatically; only cash-only deals always need admin.

### Disable approval requirement
```sql
UPDATE "Auctions" SET transfers_require_admin_approval = false WHERE id = <auction_id>;
```

---

## Schema Reference

### `auction_transfers` table (key columns)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `auction_id` | bigint | FK → Auctions |
| `proposer_id` | bigint | FK → auction_users |
| `recipient_id` | bigint | FK → auction_users |
| `proposer_player_ids` | text[] | Player IDs proposer is sending |
| `proposer_cash` | integer | £m proposer is sending |
| `recipient_player_ids` | text[] | Player IDs recipient is sending (set at respond stage) |
| `recipient_cash` | integer | £m recipient is sending (set at respond stage) |
| `status` | text | State machine value |
| `proposer_confirmed` | boolean | |
| `recipient_confirmed` | boolean | |
| `summary` | text | Auto-generated plain-English description on completion |

### `Auctions` columns added

| Column | Default | Notes |
|---|---|---|
| `transfer_window_open` | `false` | Manual admin toggle; auto-closes at hard deadline |
| `transfers_require_admin_approval` | `false` | Routes all transfers through pending_admin when true |

### Stored procedures

| Function | Called by |
|---|---|
| `propose_transfer` | Stage 1 |
| `respond_to_transfer` | Stage 2 |
| `confirm_transfer` | Stage 3 (each party) |
| `_execute_transfer_internal` | Called internally by confirm + admin_approve |
| `cancel_transfer` | Proposer at any stage |
| `reject_transfer` | Recipient at any stage |
| `admin_approve_transfer` | Commissioner, pending_admin only |
| `admin_reject_transfer` | Commissioner, pending_admin only |
| `void_expired_transfers` | Auto-called on hub page load after hard deadline |

---

## Migration

Run `scripts/sql/auction-transfers.sql` in the Supabase SQL Editor **after** `auction-bidding.sql` has been applied. The script is idempotent (`CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`).
