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

  let auctionUserId: number;

  if (authUser) {
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
    auctionUserId = Number((seat as { id: number }).id);
  } else {
    const { data: userRows, error: userErr } = await admin
      .from("auction_users")
      .select("id")
      .eq("auction_id", auctionId)
      .order("id", { ascending: true });
    if (userErr) {
      return { ok: false, message: "We couldn’t load auction managers. Try again in a moment." };
    }
    const ids = (userRows ?? []).map((r: { id: number }) => r.id);
    const cookieStore = await cookies();
    const { actorUserId, viewerMode } = resolveActorFromIds(
      auctionId,
      ids,
      parseActorCookie(cookieStore.get(AUCTION_ACTOR_COOKIE)?.value),
    );
    if (viewerMode || actorUserId == null) {
      return { ok: false, message: "Choose which manager you’re bidding as (in the header), or sign in to your own seat." };
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
