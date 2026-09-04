-- Live Auction — Transactional RPC Functions
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses CREATE OR REPLACE.
--
-- These replace the two-step DB writes in the server actions so that
-- recording and voiding a sale are always atomic — either both the sale row
-- and the player status update succeed together, or neither does.

-- ─── record_live_sale ─────────────────────────────────────────────────────────
-- Inserts a sale row AND sets the player status to 'sold' in one transaction.
-- Returns the new sale id.
--
-- Called by recordSaleAction after all application-level validation passes.

create or replace function record_live_sale(
  p_auction_id    uuid,
  p_player_id     uuid,
  p_participant_id uuid,
  p_price         integer,
  p_created_by    uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_sale_id uuid;
begin
  -- Insert the sale record
  insert into live_auction_sales (
    auction_id,
    player_id,
    participant_id,
    price,
    created_by
  )
  values (
    p_auction_id,
    p_player_id,
    p_participant_id,
    p_price,
    p_created_by
  )
  returning id into v_sale_id;

  -- Mark the player as sold so they leave the available pool
  update live_auction_players
  set status = 'sold'
  where id = p_player_id;

  return v_sale_id;
end;
$$;

-- ─── void_live_sale ───────────────────────────────────────────────────────────
-- Sets is_voided = true on the sale AND restores the player to 'available'
-- in one transaction. Raises an exception if the sale is already voided or
-- not found, which bubbles up as a Supabase RPC error.
--
-- Called by voidSaleAction after ownership/existence checks pass.

create or replace function void_live_sale(
  p_sale_id    uuid,
  p_auction_id uuid,
  p_void_reason text default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_player_id uuid;
begin
  -- Void the sale and capture the player id in one step
  update live_auction_sales
  set
    is_voided   = true,
    void_reason = p_void_reason
  where
    id          = p_sale_id
    and auction_id = p_auction_id
    and is_voided  = false
  returning player_id into v_player_id;

  -- If no row was updated the sale was already voided or doesn't exist
  if not found then
    raise exception 'Sale % not found or already voided', p_sale_id;
  end if;

  -- Return the player to the available pool
  update live_auction_players
  set status = 'available'
  where id = v_player_id;
end;
$$;
