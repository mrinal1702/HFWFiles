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
  return { ok: true };
}
