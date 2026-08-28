"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase-server";
import { getAuthUser } from "@/lib/auth/get-user";
import { requireLiveAuctionAdminAccess } from "@/lib/live-auction-auth";
import type { RecordSaleState, VoidSaleState, EditSaleState } from "@/lib/live-auction-types";

// ─── Record Sale ──────────────────────────────────────────────────────────────

export async function recordSaleAction(
  auctionId: string,
  prevState: RecordSaleState,
  formData: FormData,
): Promise<RecordSaleState> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = createAdminClient();
  const authError = await requireLiveAuctionAdminAccess(auctionId, user.id);
  if (authError) return { error: authError };

  const playerId = (formData.get("playerId") as string | null)?.trim() ?? "";
  const participantId = (formData.get("participantId") as string | null)?.trim() ?? "";
  const priceRaw = (formData.get("price") as string | null)?.trim() ?? "";

  // ── 1. Field validation ──────────────────────────────────────────────────
  const fieldErrors: NonNullable<RecordSaleState>["fieldErrors"] = {};
  if (!playerId) fieldErrors.playerId = "Select a player.";
  if (!participantId) fieldErrors.participantId = "Select a participant.";
  const priceNum = Number(priceRaw);
  const price = parseInt(priceRaw, 10);
  if (!priceRaw || isNaN(priceNum) || priceNum <= 0 || !Number.isInteger(priceNum)) {
    fieldErrors.price = "Enter a valid whole number price (e.g. 5, 45, 120).";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // ── 2. Load auction config ───────────────────────────────────────────────
  const { data: auction } = await supabase
    .from("live_auctions")
    .select("id, starting_budget, squad_size, min_bid")
    .eq("id", auctionId)
    .single();
  if (!auction) return { error: "Auction not found." };

  // ── 2a. Enforce minimum bid price ────────────────────────────────────────
  if (price < auction.min_bid) {
    return { fieldErrors: { price: `Minimum price is £${auction.min_bid}.` } };
  }

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

  // ── 6a. Squad size hard limit ────────────────────────────────────────────
  if ((existingSales ?? []).length >= auction.squad_size) {
    return {
      fieldErrors: {
        participantId: `${participant.display_name} already has a full squad (${auction.squad_size} players).`,
      },
    };
  }

  if (price > budgetRemaining) {
    return {
      fieldErrors: {
        price: `${participant.display_name} only has £${budgetRemaining} remaining — cannot spend £${price}.`,
      },
    };
  }

  // ── 7. Record the sale (atomic: inserts sale + marks player sold) ───────────
  const { error: rpcError } = await supabase.rpc("record_live_sale", {
    p_auction_id: auctionId,
    p_player_id: playerId,
    p_participant_id: participantId,
    p_price: price,
    p_created_by: user.id,
  });
  if (rpcError) return { error: `Failed to record sale: ${rpcError.message}` };

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

  const supabase = createAdminClient();
  const authError = await requireLiveAuctionAdminAccess(auctionId, user.id);
  if (authError) return { error: authError };

  const saleId = (formData.get("saleId") as string | null)?.trim() ?? "";
  const reason = (formData.get("reason") as string | null)?.trim() ?? "";

  if (!saleId) return { error: "Sale ID is required." };

  // Verify the sale exists and isn't already voided before calling the RPC
  const { data: sale } = await supabase
    .from("live_auction_sales")
    .select("id, is_voided")
    .eq("id", saleId)
    .eq("auction_id", auctionId)
    .maybeSingle();

  if (!sale) return { error: "Sale not found." };
  if (sale.is_voided) return { error: "Sale is already voided." };

  // Atomic void: sets is_voided + restores player status in one transaction
  const { error: rpcError } = await supabase.rpc("void_live_sale", {
    p_sale_id: saleId,
    p_auction_id: auctionId,
    p_void_reason: reason || null,
  });
  if (rpcError) return { error: `Failed to void sale: ${rpcError.message}` };

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

  const supabase = createAdminClient();
  const authError = await requireLiveAuctionAdminAccess(auctionId, user.id);
  if (authError) return { error: authError };

  const saleId = (formData.get("saleId") as string | null)?.trim() ?? "";
  const priceRaw = (formData.get("price") as string | null)?.trim() ?? "";
  const newParticipantId = (formData.get("participantId") as string | null)?.trim() ?? "";

  if (!saleId) return { error: "Sale ID is required." };
  const newPriceNum = Number(priceRaw);
  const newPrice = parseInt(priceRaw, 10);
  if (!priceRaw || isNaN(newPriceNum) || newPriceNum <= 0 || !Number.isInteger(newPriceNum)) {
    return { error: "Price must be a valid whole number (e.g. 5, 45, 120)." };
  }
  if (!newParticipantId) return { error: "Participant is required." };

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
    .select("starting_budget, min_bid, squad_size")
    .eq("id", auctionId)
    .single();
  if (!auction) return { error: "Auction not found." };

  if (newPrice < auction.min_bid) {
    return { error: `Minimum price is £${auction.min_bid}.` };
  }

  // Squad size check (only relevant when reassigning to a different participant)
  if (newParticipantId !== sale.participant_id) {
    const { data: newParticipantSales } = await supabase
      .from("live_auction_sales")
      .select("id")
      .eq("auction_id", auctionId)
      .eq("participant_id", newParticipantId)
      .eq("is_voided", false);
    if ((newParticipantSales ?? []).length >= auction.squad_size) {
      return { error: `The selected participant already has a full squad (${auction.squad_size} players).` };
    }
  }

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

  const supabase = createAdminClient();
  const authError = await requireLiveAuctionAdminAccess(auctionId, user.id);
  if (authError) return { error: authError };

  const playerId = (formData.get("playerId") as string | null)?.trim() ?? "";
  if (!playerId) return { error: "Player ID is required." };

  const { data: player } = await supabase
    .from("live_auction_players")
    .select("id, status, player_name")
    .eq("id", playerId)
    .eq("auction_id", auctionId)
    .maybeSingle();

  if (!player) return { error: "Player not found in this auction." };
  if (player.status === "sold") {
    return { error: `${player.player_name} is already sold. Void the sale first to mark them as passed.` };
  }
  if (player.status === "unsold") {
    return { error: `${player.player_name} is already marked as passed.` };
  }

  const { error } = await supabase
    .from("live_auction_players")
    .update({ status: "unsold" })
    .eq("id", playerId)
    .eq("auction_id", auctionId);

  if (error) return { error: error.message };

  revalidatePath(`/live-auction/${auctionId}/admin`);
  revalidatePath(`/live-auction/${auctionId}`);
  return { success: true };
}
