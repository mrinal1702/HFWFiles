import "server-only";

import { createAdminClient } from "@/lib/supabase-server";

/** True if user redeemed admin_code or has legacy participant.role = 'admin'. */
export async function userHasLiveAuctionAdminAccess(
  auctionId: string,
  userId: string,
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: grant, error: grantErr } = await supabase
    .from("live_auction_admin_grants")
    .select("id")
    .eq("auction_id", auctionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (grantErr) throw new Error(grantErr.message);
  if (grant) return true;

  const { data: legacy, error: legacyErr } = await supabase
    .from("live_auction_participants")
    .select("role")
    .eq("auction_id", auctionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (legacyErr) throw new Error(legacyErr.message);
  return legacy?.role === "admin";
}

export async function requireLiveAuctionAdminAccess(
  auctionId: string,
  userId: string,
): Promise<string | null> {
  const ok = await userHasLiveAuctionAdminAccess(auctionId, userId);
  if (!ok) return "Not authorized — enter the admin code on your dashboard first.";
  return null;
}
