"use server";

import { getAuthUser } from "@/lib/auth/get-user";
import {
  auctionNameFormatError,
  CREATE_AUCTION_COMPETITION,
  isAuctionNameTaken,
  isCreateAuctionRole,
  tidyAuctionName,
  type CreateAuctionRole,
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

export type CreateAuctionState =
  | {
      ok: true;
      /** Step 3 is a dry run: what would be created. Nothing is saved yet. */
      preview: { name: string; role: CreateAuctionRole; competition: string };
    }
  | { ok: false; message: string }
  | null;

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
  if (await isAuctionNameTaken(rawName)) {
    return { ok: false, message: "That name is already taken — auction names are unique. Try another." };
  }

  const { outcome } = await loadStartGameweekPreview(CREATE_AUCTION_COMPETITION.id);
  if (!outcome.ok) return { ok: false, message: outcome.message };

  return {
    ok: true,
    preview: { name: tidyAuctionName(rawName), role, competition: CREATE_AUCTION_COMPETITION.name },
  };
}
