import "server-only";

import { cache } from "react";

import { createAdminClient } from "@/lib/supabase-server";

/**
 * The single gate for who may open an online auction (Project Socialize V-2).
 *
 * The app reads with the service-role key, so this helper — not RLS — is the real safeguard.
 * Every spectator / guest read of an auction goes through here.
 *
 *   participant → holds a seat (`auction_users.user_id`); can act (bid, release, transfer)
 *   admin       → the auction's commissioner (`Auctions.admin_user_id`) without a seat; view only
 *   spectator   → listed in `auction_spectators`, or the auction is `visibility = 'public'`; view only
 *   none        → no access (callers 404 / redirect)
 *
 * Viewing is never permission to act: bid, release and transfer actions still resolve the
 * caller's own seat from `auction_users` and reject anyone without one.
 *
 * Schema: scripts/sql/auction-visibility.sql. Until that is applied, a missing column/table is
 * treated as "private, no spectators".
 */

export type AuctionVisibility = "private" | "public";

export type AuctionAccess =
  | { kind: "participant"; auctionUserId: number }
  | { kind: "admin" }
  | { kind: "spectator"; via: "granted" | "public" }
  | { kind: "none" };

type AuctionRow = { admin_user_id: string | null; visibility: AuctionVisibility };

function isMissingSchema(message: string, name: string): boolean {
  const m = message.toLowerCase();
  return m.includes(name) && (m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache"));
}

const loadAuctionAccessRow = cache(async (auctionId: number): Promise<AuctionRow | null> => {
  const admin = createAdminClient();
  const res = await admin
    .from("Auctions")
    .select("admin_user_id, visibility")
    .eq("id", auctionId)
    .maybeSingle();

  if (res.error) {
    if (!isMissingSchema(res.error.message, "visibility")) {
      throw new Error(`Auctions access: ${res.error.message}`);
    }
    // auction-visibility.sql not applied yet → every auction is private.
    const fallback = await admin
      .from("Auctions")
      .select("admin_user_id")
      .eq("id", auctionId)
      .maybeSingle();
    if (fallback.error) throw new Error(`Auctions access: ${fallback.error.message}`);
    if (!fallback.data) return null;
    const row = fallback.data as { admin_user_id?: string | null };
    return { admin_user_id: row.admin_user_id ?? null, visibility: "private" };
  }
  if (!res.data) return null;
  const row = res.data as { admin_user_id?: string | null; visibility?: string | null };
  return {
    admin_user_id: row.admin_user_id ?? null,
    visibility: row.visibility === "public" ? "public" : "private",
  };
});

async function isGrantedSpectator(auctionId: number, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auction_spectators")
    .select("user_id")
    .eq("auction_id", auctionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error.message, "auction_spectators")) return false;
    throw new Error(`auction_spectators: ${error.message}`);
  }
  return data != null;
}

/** Resolve what `userId` (null = logged-out visitor) may do with this auction. Cached per request. */
export const getAuctionAccess = cache(
  async (auctionId: number, userId: string | null): Promise<AuctionAccess> => {
    if (!Number.isFinite(auctionId) || auctionId <= 0) return { kind: "none" };

    const auction = await loadAuctionAccessRow(auctionId);
    if (!auction) return { kind: "none" };

    if (userId) {
      const admin = createAdminClient();
      const { data: seat, error } = await admin
        .from("auction_users")
        .select("id")
        .eq("auction_id", auctionId)
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`auction_users access: ${error.message}`);
      if (seat) return { kind: "participant", auctionUserId: Number((seat as { id: number }).id) };

      if (auction.admin_user_id && auction.admin_user_id === userId) return { kind: "admin" };
      if (await isGrantedSpectator(auctionId, userId)) return { kind: "spectator", via: "granted" };
    }

    if (auction.visibility === "public") return { kind: "spectator", via: "public" };
    return { kind: "none" };
  },
);

/** True when the viewer may open the auction's pages (participant, admin or spectator). */
export async function canViewAuction(auctionId: number, userId: string | null): Promise<boolean> {
  const access = await getAuctionAccess(auctionId, userId);
  return access.kind !== "none";
}
