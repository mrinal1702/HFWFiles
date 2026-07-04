import { createAdminClient } from "@/lib/supabase-server";
import {
  isUserRelegated,
  RELEGATION_ACTION_MESSAGE,
} from "@/lib/relegated-participants";

/** Block relegated managers from bid/transfer/release server actions. */
export async function assertActiveParticipant(
  auctionId: number,
  auctionUserId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isUserRelegated(auctionId, auctionUserId, null)) {
    return { ok: false, message: RELEGATION_ACTION_MESSAGE };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auction_users")
    .select("is_relegated")
    .eq("id", auctionUserId)
    .eq("auction_id", auctionId)
    .maybeSingle();

  if (error) {
    if (String(error.message).includes("is_relegated")) {
      return isUserRelegated(auctionId, auctionUserId, null)
        ? { ok: false, message: RELEGATION_ACTION_MESSAGE }
        : { ok: true };
    }
    return { ok: false, message: "Could not load your seat in this auction." };
  }
  if (!data) return { ok: false, message: "You're not a participant in this auction." };

  if (isUserRelegated(auctionId, auctionUserId, data.is_relegated as boolean | null)) {
    return { ok: false, message: RELEGATION_ACTION_MESSAGE };
  }

  return { ok: true };
}
