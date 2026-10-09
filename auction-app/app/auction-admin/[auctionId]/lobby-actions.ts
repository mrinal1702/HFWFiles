"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/get-user";
import { loadAuctionLobby } from "@/lib/auction-lobby";
import { loadStartGameweekPreview, MIN_LEAD_HOURS } from "@/lib/auction-state/start-gameweek";
import { userIsAuctionAdmin } from "@/lib/online-auction-admin";
import { createAdminClient } from "@/lib/supabase-server";

export type StartBiddingState = { ok: false; message: string } | null;

const START_ERRORS: Record<string, string> = {
  auction_not_found: "We couldn't find this auction.",
  not_admin: "Only this auction's admin can start bidding.",
  already_started: "Bidding has already started for this auction.",
  round_not_in_competition: "That gameweek isn't part of this auction's competition.",
  round_not_scheduled: "That gameweek's deadlines aren't published yet.",
  round_too_close: "That gameweek is now too close to start. Refresh the page to see your new first gameweek.",
};

/**
 * Lobby → bidding (irreversible). `expectedRoundId` is the gameweek the admin saw in the
 * confirm dialog; if the cutoff passed meanwhile we stop rather than start a different one.
 */
export async function startBiddingAction(
  auctionId: number,
  expectedRoundId: number,
  // Required by useActionState's (prevState, formData) signature; unused.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prev: StartBiddingState,
): Promise<StartBiddingState> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "You must be logged in." };
  if (!(await userIsAuctionAdmin(auctionId, user.id))) {
    return { ok: false, message: "Only this auction's admin can start bidding." };
  }

  const lobby = await loadAuctionLobby(auctionId);
  if (!lobby) return { ok: false, message: "Bidding has already started for this auction." };
  if (lobby.competitionId == null) return { ok: false, message: "This auction has no competition set." };

  const { outcome } = await loadStartGameweekPreview(lobby.competitionId);
  if (!outcome.ok) return { ok: false, message: outcome.message };
  if (outcome.target.id !== expectedRoundId) {
    return {
      ok: false,
      message: `Your first gameweek has changed to ${outcome.target.displayName}. Check the details above and press Start Bidding again.`,
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("start_auction_bidding", {
    p_auction_id: auctionId,
    p_admin: user.id,
    p_round_id: outcome.target.id,
    p_min_lead_hours: MIN_LEAD_HOURS,
  });
  if (error) {
    console.error("[startBiddingAction] RPC error:", error.message);
    return { ok: false, message: "We couldn't start bidding. Nothing was changed — please try again." };
  }
  const res = data as { ok: boolean; error?: string };
  if (!res.ok) return { ok: false, message: START_ERRORS[res.error ?? ""] ?? "We couldn't start bidding. Please try again." };

  revalidatePath("/dashboard");
  revalidatePath(`/auctions/${auctionId}`, "layout");
  revalidatePath(`/auction-admin/${auctionId}`, "layout");
  redirect(`/auction-admin/${auctionId}/players`);
}
