"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/get-user";
import { assertActiveParticipant } from "@/lib/relegated-guard";
import { placeBidErrorMessage } from "@/lib/auction-state/bid-ui-messages";
import { placeBid } from "@/lib/auction-state/bidding";
import { createAdminClient } from "@/lib/supabase-server";

export type AuctionBidState =
  | { ok: true; message: string }
  | { ok: false; message: string }
  | null;

export async function submitAuctionBidAction(
  _prev: AuctionBidState | null,
  formData: FormData,
): Promise<AuctionBidState> {
  const auctionId = Number(formData.get("auction_id"));
  const playerId = String(formData.get("player_id") ?? "").trim();
  const amountRaw = formData.get("amount");

  if (!Number.isFinite(auctionId) || auctionId <= 0) {
    return { ok: false, message: "Something’s wrong with this page — go back to your dashboard and open the auction again." };
  }
  if (!playerId) {
    return { ok: false, message: "Pick a player and enter an amount." };
  }

  const amountParsed = typeof amountRaw === "string" ? Number(amountRaw.trim()) : Number(amountRaw);
  if (!Number.isFinite(amountParsed) || amountParsed <= 0) {
    return { ok: false, message: "Enter a positive whole number for your bid." };
  }
  if (!Number.isInteger(amountParsed)) {
    return { ok: false, message: "Use a whole number only — no decimals." };
  }

  const authUser = await getAuthUser();
  const admin = createAdminClient();

  const { data: auctionRow, error: auctionErr } = await admin
    .from("Auctions")
    .select("is_active, hard_deadline_at")
    .eq("id", auctionId)
    .maybeSingle();
  if (auctionErr) {
    return { ok: false, message: "We couldn’t load this auction. Try again in a moment." };
  }
  if (!auctionRow) {
    return { ok: false, message: "This auction doesn’t exist." };
  }
  if (auctionRow.is_active === false) {
    return { ok: false, message: "This auction is paused right now — bidding is closed." };
  }
  const hardMs = auctionRow.hard_deadline_at ? Date.parse(auctionRow.hard_deadline_at) : NaN;
  if (Number.isFinite(hardMs) && Date.now() >= hardMs) {
    return { ok: false, message: "Bidding has ended — the auction deadline has passed." };
  }

  // Bids always come from the signed-in user's own seat. There is no fallback to
  // another manager: a visitor without a login or without a seat cannot bid.
  if (!authUser) {
    return { ok: false, message: "Sign in to bid in this auction." };
  }
  const { data: seat, error: seatErr } = await admin
    .from("auction_users")
    .select("id")
    .eq("auction_id", auctionId)
    .eq("user_id", authUser.id)
    .maybeSingle();
  if (seatErr) {
    return { ok: false, message: "We couldn’t load your seat in this auction. Try again in a moment." };
  }
  if (!seat) {
    return { ok: false, message: "You’re not in this auction yet — join with a code from your commissioner." };
  }
  const auctionUserId = Number((seat as { id: number }).id);

  const active = await assertActiveParticipant(auctionId, auctionUserId);
  if (!active.ok) return { ok: false, message: active.message };

  const { data, rpcError } = await placeBid(admin, {
    auctionId,
    auctionUserId,
    playerId,
    amount: Math.floor(amountParsed),
  });

  revalidatePath("/auctions", "layout");
  revalidatePath(`/auctions/${auctionId}`, "layout");

  if (rpcError) {
    return { ok: false, message: "We couldn’t complete that bid. Tap Refresh and try again." };
  }
  if (!data) {
    return { ok: false, message: "We didn’t get a clear result. Tap Refresh and try your bid again." };
  }
  if (!data.ok) {
    return { ok: false, message: placeBidErrorMessage(data.error) };
  }

  return {
    ok: true,
    message: "Bid placed! Tap Refresh to see the latest high bids and timers.",
  };
}
