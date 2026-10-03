"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase-server";
import { requireAuctionAdmin, isGoalkeeperPosition } from "@/lib/online-auction-admin";
import { fetchPlayerMetaByIds, resolveAuctionCompetitionId } from "@/lib/players-query";
import { SQUAD_LIMIT } from "@/lib/squad-limit";

export type AdminActionState = { ok?: boolean; error?: string; message?: string } | null;

function revalidateAdmin(auctionId: number, participantId: number) {
  revalidatePath(`/auction-admin/${auctionId}/players`);
  revalidatePath(`/auction-admin/${auctionId}/players/${participantId}`);
  revalidatePath(`/auction-admin/${auctionId}/players/${participantId}/add`);
  revalidatePath(`/auction-admin/${auctionId}/players/${participantId}/remove`);
  // Participant-facing pages reflect squad changes too.
  revalidatePath(`/auctions/${auctionId}`);
}

/**
 * Admin credit: add a free-agent player to a participant's team at an admin-set
 * buy price. Budget is intentionally NOT deducted (admin override). Enforces the
 * roster caps (<=1 GK, <=SQUAD_LIMIT players), counting bids currently held.
 */
export async function adminAddPlayerToTeam(
  auctionId: number,
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated." };

  const authError = await requireAuctionAdmin(auctionId, user.id);
  if (authError) return { error: authError };

  const participantId = Number((formData.get("participantId") as string | null)?.trim() ?? "");
  const playerId = (formData.get("playerId") as string | null)?.trim() ?? "";
  const priceRaw = (formData.get("price") as string | null)?.trim() ?? "";

  if (!Number.isFinite(participantId) || participantId <= 0) return { error: "Invalid participant." };
  if (!playerId) return { error: "Select a player." };

  const priceNum = Number(priceRaw);
  const price = parseInt(priceRaw, 10);
  if (!priceRaw || Number.isNaN(priceNum) || priceNum <= 0 || !Number.isInteger(priceNum)) {
    return { error: "Enter a valid whole-number buy price (e.g. 5, 45, 120)." };
  }

  const admin = createAdminClient();

  // Auction (for competition-scoped player metadata).
  const { data: auction, error: auctionErr } = await admin
    .from("Auctions")
    .select("id, competition_id")
    .eq("id", auctionId)
    .maybeSingle();
  if (auctionErr) return { error: `Auction lookup failed: ${auctionErr.message}` };
  if (!auction) return { error: "Auction not found." };
  const competitionId = resolveAuctionCompetitionId(auction as { competition_id?: number | null });

  // Participant must exist in this auction.
  const { data: participant, error: partErr } = await admin
    .from("auction_users")
    .select("id, name")
    .eq("id", participantId)
    .eq("auction_id", auctionId)
    .maybeSingle();
  if (partErr) return { error: `Participant lookup failed: ${partErr.message}` };
  if (!participant) return { error: "Participant not found in this auction." };
  const participantName = (participant as { name: string | null }).name ?? "this participant";

  // Lot must exist and be a free agent (uninitiated/unsold — not sold, no active bid).
  const { data: lot, error: lotErr } = await admin
    .from("auction_lots")
    .select("player_id, status")
    .eq("auction_id", auctionId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (lotErr) return { error: `Lot lookup failed: ${lotErr.message}` };
  if (!lot) return { error: "Player is not part of this auction." };
  const status = String((lot as { status: string }).status);
  if (status === "sold") return { error: "That player has already been bought." };
  if (status === "bidding") {
    return { error: "That player is under active bidding — cancel the bid first (Cancel Bids)." };
  }

  // Defensive: ensure not already on any team.
  const { data: existingTeamRow, error: existErr } = await admin
    .from("auction_teams")
    .select("id")
    .eq("auction_id", auctionId)
    .eq("player_id", Number(playerId))
    .maybeSingle();
  if (existErr) return { error: `Team check failed: ${existErr.message}` };
  if (existingTeamRow) return { error: "That player is already on a team." };

  // Current roster: owned players + bids currently held by this participant.
  const [ownedRes, bidsRes] = await Promise.all([
    admin
      .from("auction_teams")
      .select("player_id")
      .eq("auction_id", auctionId)
      .eq("auction_user_id", participantId),
    admin
      .from("auction_lots")
      .select("player_id")
      .eq("auction_id", auctionId)
      .eq("status", "bidding")
      .eq("current_high_bidder_id", participantId),
  ]);
  if (ownedRes.error) return { error: `Roster lookup failed: ${ownedRes.error.message}` };
  if (bidsRes.error) return { error: `Bids lookup failed: ${bidsRes.error.message}` };

  const ownedIds = (ownedRes.data ?? []).map((r) => String((r as { player_id: string | number }).player_id));
  const bidIds = (bidsRes.data ?? []).map((r) => String((r as { player_id: string | number }).player_id));
  const rosterCount = ownedIds.length + bidIds.length;

  if (rosterCount >= SQUAD_LIMIT) {
    return {
      error: `${participantName} already has ${rosterCount} players (incl. bids held). The limit is ${SQUAD_LIMIT}.`,
    };
  }

  // Goalkeeper cap: count GKs across owned + bids held, plus the incoming player.
  const metaIds = [...new Set([...ownedIds, ...bidIds, String(playerId)])];
  const meta = await fetchPlayerMetaByIds(admin, metaIds, competitionId);

  const incomingIsGk = isGoalkeeperPosition(meta[String(playerId)]?.position ?? null);
  if (incomingIsGk) {
    const existingGk = [...ownedIds, ...bidIds].some((id) =>
      isGoalkeeperPosition(meta[id]?.position ?? null),
    );
    if (existingGk) {
      return { error: `${participantName} already has a goalkeeper (one GK per team, incl. bids held).` };
    }
  }

  // Insert team row (admin credit) — budget untouched.
  const { error: insertErr } = await admin.from("auction_teams").insert({
    auction_id: auctionId,
    auction_user_id: participantId,
    player_id: Number(playerId),
    purchase_price: price,
  });
  if (insertErr) return { error: `Failed to add player: ${insertErr.message}` };

  // Mark the lot sold and clear any bid pointers.
  const { error: lotUpdateErr } = await admin
    .from("auction_lots")
    .update({
      status: "sold",
      current_high_bid_id: null,
      current_high_bidder_id: null,
      expires_at: null,
    })
    .eq("auction_id", auctionId)
    .eq("player_id", playerId);
  if (lotUpdateErr) {
    // Roll back the team insert so we don't leave an orphaned ownership row.
    await admin
      .from("auction_teams")
      .delete()
      .eq("auction_id", auctionId)
      .eq("auction_user_id", participantId)
      .eq("player_id", Number(playerId));
    return { error: `Failed to update lot: ${lotUpdateErr.message}` };
  }

  revalidateAdmin(auctionId, participantId);
  return { ok: true, message: "The transfer is complete. Budgets are not deducted." };
}

/**
 * Admin remove: take a player off a participant's team and return the lot to the
 * free-agent pool (status 'uninitiated'). Budget is intentionally NOT changed.
 */
export async function adminRemovePlayerFromTeam(
  auctionId: number,
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated." };

  const authError = await requireAuctionAdmin(auctionId, user.id);
  if (authError) return { error: authError };

  const participantId = Number((formData.get("participantId") as string | null)?.trim() ?? "");
  const playerId = (formData.get("playerId") as string | null)?.trim() ?? "";

  if (!Number.isFinite(participantId) || participantId <= 0) return { error: "Invalid participant." };
  if (!playerId) return { error: "Missing player." };

  const admin = createAdminClient();

  const { data: teamRow, error: teamErr } = await admin
    .from("auction_teams")
    .select("id")
    .eq("auction_id", auctionId)
    .eq("auction_user_id", participantId)
    .eq("player_id", Number(playerId))
    .maybeSingle();
  if (teamErr) return { error: `Team lookup failed: ${teamErr.message}` };
  if (!teamRow) return { error: "That player is not on this participant's team." };

  const { error: deleteErr } = await admin
    .from("auction_teams")
    .delete()
    .eq("id", (teamRow as { id: number }).id);
  if (deleteErr) return { error: `Failed to remove player: ${deleteErr.message}` };

  const { error: lotUpdateErr } = await admin
    .from("auction_lots")
    .update({
      status: "uninitiated",
      current_high_bid_id: null,
      current_high_bidder_id: null,
      expires_at: null,
    })
    .eq("auction_id", auctionId)
    .eq("player_id", playerId);
  if (lotUpdateErr) return { error: `Player removed, but lot reset failed: ${lotUpdateErr.message}` };

  revalidateAdmin(auctionId, participantId);
  return { ok: true, message: "Player removed — they are back in the unsold player list as a free agent." };
}

/**
 * Admin budget adjustment. "give" adds fresh money to both budget_remaining and
 * active_budget (new money is not tied up in any bid). "take" subtracts from both
 * and is blocked if it would push active_budget (or budget_remaining) below 0.
 */
export async function adminModifyBudget(
  auctionId: number,
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated." };

  const authError = await requireAuctionAdmin(auctionId, user.id);
  if (authError) return { error: authError };

  const participantId = Number((formData.get("participantId") as string | null)?.trim() ?? "");
  const direction = (formData.get("direction") as string | null)?.trim() ?? "";
  const amountRaw = (formData.get("amount") as string | null)?.trim() ?? "";

  if (!Number.isFinite(participantId) || participantId <= 0) return { error: "Invalid participant." };
  if (direction !== "give" && direction !== "take") return { error: "Invalid action." };

  const amountNum = Number(amountRaw);
  const amount = parseInt(amountRaw, 10);
  if (!amountRaw || Number.isNaN(amountNum) || amountNum <= 0 || !Number.isInteger(amountNum)) {
    return { error: "Enter a valid whole-number amount (e.g. 5, 25, 100)." };
  }

  const admin = createAdminClient();

  const { data: participant, error: partErr } = await admin
    .from("auction_users")
    .select("id, name, budget_remaining, active_budget")
    .eq("id", participantId)
    .eq("auction_id", auctionId)
    .maybeSingle();
  if (partErr) return { error: `Participant lookup failed: ${partErr.message}` };
  if (!participant) return { error: "Participant not found in this auction." };

  const p = participant as {
    name: string | null;
    budget_remaining: number;
    active_budget: number;
  };
  const name = p.name ?? "this participant";

  let newRemaining: number;
  let newActive: number;

  if (direction === "give") {
    newRemaining = p.budget_remaining + amount;
    newActive = p.active_budget + amount;
  } else {
    if (amount > p.active_budget) {
      return {
        error: `${name} only has £${p.active_budget} active budget — taking £${amount} would go negative.`,
      };
    }
    if (amount > p.budget_remaining) {
      return {
        error: `${name} only has £${p.budget_remaining} remaining budget — taking £${amount} would go negative.`,
      };
    }
    newRemaining = p.budget_remaining - amount;
    newActive = p.active_budget - amount;
  }

  const { error: updateErr } = await admin
    .from("auction_users")
    .update({ budget_remaining: newRemaining, active_budget: newActive })
    .eq("id", participantId)
    .eq("auction_id", auctionId);
  if (updateErr) return { error: `Failed to update budget: ${updateErr.message}` };

  revalidatePath(`/auction-admin/${auctionId}/budget`);
  revalidatePath(`/auction-admin/${auctionId}/players`);
  revalidatePath(`/auction-admin/${auctionId}/players/${participantId}`);
  revalidatePath(`/auctions/${auctionId}`);

  const verb = direction === "give" ? "Added" : "Took";
  const prep = direction === "give" ? "to" : "from";
  return {
    ok: true,
    message: `${verb} £${amount} ${prep} ${name}. Remaining £${newRemaining}, Active £${newActive}.`,
  };
}
