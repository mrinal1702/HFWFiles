"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/get-user";
import { JOIN_DEFAULT_BUDGET } from "@/lib/join-constants";
import { createAdminClient } from "@/lib/supabase-server";

export type JoinAuctionState = { ok: false; message: string } | null;

function normalizeJoinCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function joinAuctionByCodeAction(
  _prev: JoinAuctionState | null,
  formData: FormData,
): Promise<JoinAuctionState> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, message: "You must be logged in." };
  }

  const code = normalizeJoinCode(String(formData.get("code") ?? ""));
  if (code.length < 6 || code.length > 8) {
    return { ok: false, message: "Enter a join code (6–8 letters or numbers)." };
  }

  const admin = createAdminClient();
  const { data: auction, error: aErr } = await admin
    .from("Auctions")
    .select("id,max_participants,join_code")
    .eq("join_code", code)
    .maybeSingle();

  if (aErr) {
    return { ok: false, message: aErr.message };
  }
  if (!auction) {
    return { ok: false, message: "No auction found for that code." };
  }

  const auctionId = Number(auction.id);
  const maxP = Math.min(12, Math.max(1, Number(auction.max_participants ?? 12)));

  const { data: existing } = await admin
    .from("auction_users")
    .select("id")
    .eq("auction_id", auctionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return { ok: false, message: "You are already part of this auction." };
  }

  const { count, error: cErr } = await admin
    .from("auction_users")
    .select("id", { count: "exact", head: true })
    .eq("auction_id", auctionId);

  if (cErr) {
    return { ok: false, message: cErr.message };
  }
  if ((count ?? 0) >= maxP) {
    return { ok: false, message: "This auction is full." };
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName =
    (prof as { display_name: string } | null)?.display_name ??
    user.email?.split("@")[0] ??
    "Player";

  const { error: insErr } = await admin.from("auction_users").insert({
    auction_id: auctionId,
    name: displayName,
    budget_remaining: JOIN_DEFAULT_BUDGET,
    active_budget: JOIN_DEFAULT_BUDGET,
    user_id: user.id,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return { ok: false, message: "You are already part of this auction." };
    }
    return { ok: false, message: insErr.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/auctions", "layout");
  redirect(`/auctions/${auctionId}/bidding-room`);
}
