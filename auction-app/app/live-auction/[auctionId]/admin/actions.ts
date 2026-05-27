"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase-server";
import { getAuthUser } from "@/lib/auth/get-user";
import type { RecordSaleState, VoidSaleState, EditSaleState } from "@/lib/live-auction-types";

// ─── Record Sale ──────────────────────────────────────────────────────────────

/**
 * Validates and records a completed sale.
 *
 * Validation order:
 *   1. Field presence / basic format
 *   2. Player exists and is available
 *   3. No duplicate non-voided sale for this player
 *   4. Participant exists in this auction
 *   5. Participant has enough budget remaining (hard block)
 *   6. Minimum reserve warning (soft — admin must acknowledge)
 *
 * Bind `auctionId` before passing to useActionState:
 *   const action = recordSaleAction.bind(null, auctionId)
 */
export async function recordSaleAction(
  auctionId: string,
  prevState: RecordSaleState,
  formData: FormData,
): Promise<RecordSaleState> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated." };

  const playerId = (formData.get("playerId") as string | null)?.trim() ?? "";
  const participantId = (formData.get("participantId") as string | null)?.trim() ?? "";
  const priceRaw = (formData.get("price") as string | null)?.trim() ?? "";
  // overrideWarning is set by the client when the admin acknowledges the soft warning
  const overrideWarning = formData.get("overrideWarning") === "true";

  // ── 1. Field validation ──────────────────────────────────────────────────
  const fieldErrors: NonNullable<RecordSaleState>["fieldErrors"] = {};
  if (!playerId) fieldErrors.playerId = "Select a player.";
  if (!participantId) fieldErrors.participantId = "Select a participant.";
  const price = parseInt(priceRaw, 10);
  if (!priceRaw || isNaN(price) || price <= 0) fieldErrors.price = "Enter a valid price above £0.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = createAdminClient();

  // ── 2. Load auction config ───────────────────────────────────────────────
  const { data: auction } = await supabase
    .from("live_auctions")
    .select("id, starting_budget, squad_size, min_bid")
    .eq("id", auctionId)
    .single();
  if (!auction) return { error: "Auction not found." };

  // ── 3. Player must exist in this auction and be available ────────────────
  const { data: player } = await supabase
    .from("live_auction_players")
    .select("id, status, player_name")
    .eq("id", playerId)
    .eq("auction_id", auctionId)
    .maybeSingle();
  if (!player) return { fieldErrors: { playerId: "Player not found in this auction." } };
  if (player.status === "sold")
    return { fieldErrors: { playerId: `${player.player_name} has already been sold.` } };
  if (player.status === "unsold")
    return { fieldErrors: { playerId: `${player.player_name} is marked as unsold/skipped.` } };

  // ── 4. Double-check: no existing non-voided sale for this player ─────────
  const { data: existingSale } = await supabase
    .from("live_auction_sales")
    .select("id")
    .eq("player_id", playerId)
    .eq("is_voided", false)
    .maybeSingle();
  if (existingSale) return { fieldErrors: { playerId: "Player already has an active sale." } };

  // ── 5. Participant must exist in this auction ────────────────────────────
  const { data: participant } = await supabase
    .from("live_auction_participants")
    .select("id, display_name")
    .eq("id", participantId)
    .eq("auction_id", auctionId)
    .maybeSingle();
  if (!participant) return { fieldErrors: { participantId: "Participant not found in this auction." } };

  // ── 6. Budget check (hard block) ────────────────────────────────────────
  const { data: existingSales } = await supabase
    .from("live_auction_sales")
    .select("price")
    .eq("auction_id", auctionId)
    .eq("participant_id", participantId)
    .eq("is_voided", false);

  const totalSpent = (existingSales ?? []).reduce((sum, s) => sum + s.price, 0);
  const budgetRemaining = auction.starting_budget - totalSpent;

  if (price > budgetRemaining) {
    return {
      fieldErrors: {
        price: `${participant.display_name} only has £${budgetRemaining} remaining — cannot spend £${price}.`,
      },
    };
  }

  // ── 7. Minimum reserve warning (soft — can be overridden) ────────────────
  // After this purchase: does the participant still have enough budget to fill
  // remaining squad slots at min_bid? This is advisory, not a hard block.
  const playersAfter = (existingSales ?? []).length + 1;
  const slotsLeft = auction.squad_size - playersAfter;
  const budgetAfter = budgetRemaining - price;
  const minReserveNeeded = Math.max(0, slotsLeft) * auction.min_bid;

  if (!overrideWarning && slotsLeft > 0 && budgetAfter < minReserveNeeded) {
    return {
      warning:
        `After this purchase, ${participant.display_name} will have £${budgetAfter} left ` +
        `but would need at least £${minReserveNeeded} to fill ${slotsLeft} remaining ` +
        `slot${slotsLeft !== 1 ? "s" : ""} at the £${auction.min_bid} minimum bid. ` +
        `This is a soft limit — proceed if this is intentional.`,
    };
  }

  // ── 8. Record the sale ───────────────────────────────────────────────────
  const { error: insertError } = await supabase.from("live_auction_sales").insert({
    auction_id: auctionId,
    player_id: playerId,
    participant_id: participantId,
    price,
    created_by: user.id,
  });
  if (insertError) return { error: `Failed to record sale: ${insertError.message}` };

  // Mark the player as sold so they no longer appear in the available list
  await supabase
    .from("live_auction_players")
    .update({ status: "sold" })
    .eq("id", playerId);

  revalidatePath(`/live-auction/${auctionId}/admin`);
  revalidatePath(`/live-auction/${auctionId}`);

  return { success: true };
}

// ─── Void Sale ────────────────────────────────────────────────────────────────

/**
 * Voids a sale and restores the player to available.
 * saleId and optional void_reason are read from formData.
 *
 * Bind `auctionId` before passing to useActionState.
 */
export async function voidSaleAction(
  auctionId: string,
  prevState: VoidSaleState,
  formData: FormData,
): Promise<VoidSaleState> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated." };

  const saleId = (formData.get("saleId") as string | null)?.trim() ?? "";
  const reason = (formData.get("reason") as string | null)?.trim() ?? "";

  if (!saleId) return { error: "Sale ID is required." };

  const supabase = createAdminClient();

  const { data: sale } = await supabase
    .from("live_auction_sales")
    .select("id, player_id, is_voided")
    .eq("id", saleId)
    .eq("auction_id", auctionId)
    .maybeSingle();

  if (!sale) return { error: "Sale not found." };
  if (sale.is_voided) return { error: "Sale is already voided." };

  const { error: voidError } = await supabase
    .from("live_auction_sales")
    .update({ is_voided: true, void_reason: reason || null })
    .eq("id", saleId);
  if (voidError) return { error: `Failed to void sale: ${voidError.message}` };

  // Restore player to available so they can be auctioned again
  await supabase
    .from("live_auction_players")
    .update({ status: "available" })
    .eq("id", sale.player_id);

  revalidatePath(`/live-auction/${auctionId}/admin`);
  revalidatePath(`/live-auction/${auctionId}`);

  return { success: true };
}

// ─── Edit Sale ────────────────────────────────────────────────────────────────

/**
 * Edits the price and/or participant of an existing non-voided sale.
 * Runs a budget check for the new participant, excluding the sale being edited.
 *
 * saleId, price, and participantId are read from formData.
 * Bind `auctionId` before passing to useActionState.
 */
export async function editSaleAction(
  auctionId: string,
  prevState: EditSaleState,
  formData: FormData,
): Promise<EditSaleState> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated." };

  const saleId = (formData.get("saleId") as string | null)?.trim() ?? "";
  const priceRaw = (formData.get("price") as string | null)?.trim() ?? "";
  const newParticipantId = (formData.get("participantId") as string | null)?.trim() ?? "";

  if (!saleId) return { error: "Sale ID is required." };
  const newPrice = parseInt(priceRaw, 10);
  if (isNaN(newPrice) || newPrice <= 0) return { error: "Price must be a positive number." };
  if (!newParticipantId) return { error: "Participant is required." };

  const supabase = createAdminClient();

  const { data: sale } = await supabase
    .from("live_auction_sales")
    .select("id, participant_id, price, is_voided")
    .eq("id", saleId)
    .eq("auction_id", auctionId)
    .maybeSingle();

  if (!sale) return { error: "Sale not found." };
  if (sale.is_voided) return { error: "Cannot edit a voided sale. Undo the void first." };

  const { data: auction } = await supabase
    .from("live_auctions")
    .select("starting_budget")
    .eq("id", auctionId)
    .single();
  if (!auction) return { error: "Auction not found." };

  // Budget check for the new participant, excluding this sale from the calculation
  const { data: otherSales } = await supabase
    .from("live_auction_sales")
    .select("price")
    .eq("auction_id", auctionId)
    .eq("participant_id", newParticipantId)
    .eq("is_voided", false)
    .neq("id", saleId);

  const otherSpent = (otherSales ?? []).reduce((sum, s) => sum + s.price, 0);
  const budgetAvailable = auction.starting_budget - otherSpent;

  if (newPrice > budgetAvailable) {
    return {
      error: `Participant only has £${budgetAvailable} available for this slot (budget minus their other purchases). Price £${newPrice} exceeds this.`,
    };
  }

  const { error: updateError } = await supabase
    .from("live_auction_sales")
    .update({ price: newPrice, participant_id: newParticipantId })
    .eq("id", saleId);
  if (updateError) return { error: `Failed to update sale: ${updateError.message}` };

  revalidatePath(`/live-auction/${auctionId}/admin`);
  revalidatePath(`/live-auction/${auctionId}`);

  return { success: true };
}

// ─── Mark Unsold ──────────────────────────────────────────────────────────────

/**
 * Marks a player as unsold/skipped. They will no longer appear in the available list.
 * playerId is read from formData.
 */
export async function markUnsoldAction(
  auctionId: string,
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated." };

  const playerId = (formData.get("playerId") as string | null)?.trim() ?? "";
  if (!playerId) return { error: "Player ID is required." };

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("live_auction_players")
    .update({ status: "unsold" })
    .eq("id", playerId)
    .eq("auction_id", auctionId);

  if (error) return { error: error.message };

  revalidatePath(`/live-auction/${auctionId}/admin`);
  return { success: true };
}
