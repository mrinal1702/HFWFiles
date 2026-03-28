"use server";

import { revalidatePath } from "next/cache";

import { getLabAuctionId } from "@/lib/auction-lab-config";
import { placeBid } from "@/lib/bidding";
import { createAdminClient } from "@/lib/supabase-server";

export type BidFormState =
  | { ok: true; message: string }
  | { ok: false; message: string }
  | null;

export async function submitBidAction(
  _prev: BidFormState | null,
  formData: FormData,
): Promise<BidFormState> {
  const auctionId = getLabAuctionId();
  const auctionUserId = Number(formData.get("auction_user_id"));
  const playerId = String(formData.get("player_id") ?? "").trim();
  const amountRaw = formData.get("amount");
  const amount = typeof amountRaw === "string" ? Number(amountRaw) : Number(amountRaw);

  if (!Number.isFinite(auctionUserId) || auctionUserId <= 0) {
    return { ok: false, message: "Pick a valid bidder (auction user)." };
  }
  if (!playerId) {
    return { ok: false, message: "Pick a player (lot)." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Enter a valid whole-number bid amount." };
  }

  try {
    const admin = createAdminClient();
    const { data, rpcError } = await placeBid(admin, {
      auctionId,
      auctionUserId,
      playerId,
      amount: Math.floor(amount),
    });

    revalidatePath("/auction-lab");

    if (rpcError) {
      return { ok: false, message: rpcError.message };
    }
    if (!data) {
      return { ok: false, message: "No response from place_bid." };
    }
    if (!data.ok) {
      return { ok: false, message: `Rejected: ${data.error}` };
    }

    return {
      ok: true,
      message: `Bid recorded (id ${data.bid_id}). Lot expires at ${data.expires_at}. Refresh to see updated budgets.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}
