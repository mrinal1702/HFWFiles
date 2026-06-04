"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/get-user";
import { loadAuctionDashboard } from "@/lib/auction-dashboard";
import { createAdminClient } from "@/lib/supabase-server";

export type ReleaseResult =
  | { ok: true; refundAmount: number }
  | { ok: false; error: string };

const RPC_ERROR_MESSAGES: Record<string, string> = {
  invalid_release_type: "Invalid release type.",
  player_not_owned: "You don't own this player.",
  paid_release_already_used: "You have already used your paid release this Game Week.",
};

export async function releasePlayerAction(
  auctionId: number,
  playerId: string,
  releaseType: "paid" | "free",
): Promise<ReleaseResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, error: "You must be logged in to release a player." };
  }

  const d = await loadAuctionDashboard(auctionId, user.id);
  if (!d.me) {
    return { ok: false, error: "You are not a participant in this auction." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("release_player", {
    p_auction_id: auctionId,
    p_player_id: playerId,
    p_auction_user_id: d.me.id,
    p_release_type: releaseType,
  });

  if (error) {
    console.error("[releasePlayerAction] RPC error:", error.message);
    return { ok: false, error: "Release failed. Please try again." };
  }

  const result = data as { ok: boolean; error?: string; refund_amount?: number };

  if (!result.ok) {
    const msg = RPC_ERROR_MESSAGES[result.error ?? ""] ?? "Release failed. Please try again.";
    return { ok: false, error: msg };
  }

  revalidatePath(`/auctions/${auctionId}/team`);
  revalidatePath(`/auctions/${auctionId}/bidding-room`);

  return { ok: true, refundAmount: result.refund_amount ?? 0 };
}
