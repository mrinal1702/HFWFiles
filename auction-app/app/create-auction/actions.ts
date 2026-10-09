"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/get-user";
import {
  auctionNameFormatError,
  CREATE_AUCTION_COMPETITION,
  createSelfServeAuction,
  isAuctionNameTaken,
  isCreateAuctionRole,
  loadCreatorDisplayName,
} from "@/lib/auction-create";
import { loadStartGameweekPreview } from "@/lib/auction-state/start-gameweek";

export type NameCheckState = { available: boolean; message: string | null };

/** Live name check while the commissioner types. */
export async function checkAuctionNameAction(rawName: string): Promise<NameCheckState> {
  const user = await getAuthUser();
  if (!user) return { available: false, message: "You must be logged in." };

  const formatError = auctionNameFormatError(rawName);
  if (formatError) return { available: false, message: formatError };
  if (await isAuctionNameTaken(rawName)) {
    return { available: false, message: "That name is already taken — auction names are unique. Try another." };
  }
  return { available: true, message: null };
}

export type CreateAuctionState = { ok: false; message: string } | null;

/** Creates the auction in the lobby state, then lands the creator on their dashboard. */
export async function createAuctionAction(
  _prev: CreateAuctionState,
  formData: FormData,
): Promise<CreateAuctionState> {
  const user = await getAuthUser();
  if (!user) return { ok: false, message: "You must be logged in." };

  const rawName = String(formData.get("name") ?? "");
  const role = formData.get("role");

  const formatError = auctionNameFormatError(rawName);
  if (formatError) return { ok: false, message: formatError };
  if (!isCreateAuctionRole(role)) return { ok: false, message: "Choose whether you'll play as well as admin." };

  const { outcome } = await loadStartGameweekPreview(CREATE_AUCTION_COMPETITION.id);
  if (!outcome.ok) return { ok: false, message: outcome.message };

  // The DB function re-checks the name atomically (unique index), so a race can't create duplicates.
  if (await isAuctionNameTaken(rawName)) {
    return { ok: false, message: "That name is already taken — auction names are unique. Try another." };
  }

  const res = await createSelfServeAuction({
    creatorId: user.id,
    name: rawName,
    play: role === "play_and_admin",
    seatName: await loadCreatorDisplayName(user),
  });
  if (!res.ok) return { ok: false, message: res.message };

  revalidatePath("/dashboard");
  redirect(`/dashboard?created=${res.auction.auctionId}`);
}
