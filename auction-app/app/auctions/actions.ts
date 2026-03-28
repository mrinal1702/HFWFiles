"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  AUCTION_ACTOR_COOKIE,
  parseActorCookie,
  resolveActorFromIds,
  serializeActorMap,
} from "@/lib/auction-actor-cookie";
import { getAuthUser } from "@/lib/auth/get-user";
import { placeBidErrorMessage } from "@/lib/bid-ui-messages";
import { placeBid } from "@/lib/bidding";
import { createAdminClient } from "@/lib/supabase-server";

export type AuctionBidState =
  | { ok: true; message: string }
  | { ok: false; message: string }
  | null;

export async function setAuctionActorAction(auctionId: number, auctionUserId: number | null) {
  const admin = createAdminClient();
  if (auctionUserId !== null) {
    const { data: row } = await admin
      .from("auction_users")
      .select("id")
      .eq("auction_id", auctionId)
      .eq("id", auctionUserId)
      .maybeSingle();
    if (!row) {
      return;
    }
  }

  const c = await cookies();
  const map = parseActorCookie(c.get(AUCTION_ACTOR_COOKIE)?.value);
  if (auctionUserId === null) {
    map[String(auctionId)] = null;
  } else {
    map[String(auctionId)] = auctionUserId;
  }
  c.set(AUCTION_ACTOR_COOKIE, serializeActorMap(map), {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
    httpOnly: true,
  });
  revalidatePath("/auctions", "layout");
  revalidatePath(`/auctions/${auctionId}`, "layout");
}

export async function submitAuctionBidAction(
  _prev: AuctionBidState | null,
  formData: FormData,
): Promise<AuctionBidState> {
  const auctionId = Number(formData.get("auction_id"));
  const playerId = String(formData.get("player_id") ?? "").trim();
  const amountRaw = formData.get("amount");

  if (!Number.isFinite(auctionId) || auctionId <= 0) {
    return { ok: false, message: "Missing auction." };
  }
  if (!playerId) {
    return { ok: false, message: "Missing player." };
  }

  const amountParsed = typeof amountRaw === "string" ? Number(amountRaw.trim()) : Number(amountRaw);
  if (!Number.isFinite(amountParsed) || amountParsed <= 0) {
    return { ok: false, message: "Enter a positive whole number." };
  }
  if (!Number.isInteger(amountParsed)) {
    return { ok: false, message: "Whole numbers only (no decimals)." };
  }

  const authUser = await getAuthUser();
  const admin = createAdminClient();

  let auctionUserId: number;

  if (authUser) {
    const { data: seat, error: seatErr } = await admin
      .from("auction_users")
      .select("id")
      .eq("auction_id", auctionId)
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (seatErr) {
      return { ok: false, message: seatErr.message };
    }
    if (!seat) {
      return { ok: false, message: "You are not a member of this auction." };
    }
    auctionUserId = Number((seat as { id: number }).id);
  } else {
    const { data: userRows, error: userErr } = await admin
      .from("auction_users")
      .select("id")
      .eq("auction_id", auctionId)
      .order("id", { ascending: true });
    if (userErr) {
      return { ok: false, message: userErr.message };
    }
    const ids = (userRows ?? []).map((r: { id: number }) => r.id);
    const cookieStore = await cookies();
    const { actorUserId, viewerMode } = resolveActorFromIds(
      auctionId,
      ids,
      parseActorCookie(cookieStore.get(AUCTION_ACTOR_COOKIE)?.value),
    );
    if (viewerMode || actorUserId == null) {
      return { ok: false, message: "You cannot bid (view only or pick a manager in the header)." };
    }
    auctionUserId = actorUserId;
  }

  const { data, rpcError } = await placeBid(admin, {
    auctionId,
    auctionUserId,
    playerId,
    amount: Math.floor(amountParsed),
  });

  revalidatePath("/auctions", "layout");
  revalidatePath(`/auctions/${auctionId}`, "layout");

  if (rpcError) {
    return { ok: false, message: rpcError.message };
  }
  if (!data) {
    return { ok: false, message: "No response from place_bid." };
  }
  if (!data.ok) {
    return { ok: false, message: placeBidErrorMessage(data.error) };
  }

  return {
    ok: true,
    message: "Bid accepted. Tables refresh from the server — use Refresh if values look stale.",
  };
}
