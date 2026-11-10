import "server-only";

import { cache } from "react";

import { getAuctionAccess } from "@/lib/auction-access";
import { createAdminClient } from "@/lib/supabase-server";

/**
 * Read-only auction facts for link previews and page titles (Project Socialize H-2).
 * Never calls loadAuctionDashboard (which can finalize lots): previews must not write.
 *
 * `publicView` is what a logged-out visitor may see — link-preview crawlers (WhatsApp etc.) are
 * logged out, so a preview only shows auction data when a guest could open the page anyway.
 */
export type OgAuctionSummary = {
  id: number;
  name: string;
  competitionName: string | null;
  managerCount: number;
  /** True when a logged-out visitor may view this auction (public and started). */
  publicView: boolean;
};

export const loadOgAuctionSummary = cache(
  async (auctionId: number): Promise<OgAuctionSummary | null> => {
    if (!Number.isFinite(auctionId) || auctionId <= 0) return null;
    const admin = createAdminClient();

    const { data: auction, error } = await admin
      .from("Auctions")
      .select("id, name, status, competition_id")
      .eq("id", auctionId)
      .maybeSingle();
    if (error || !auction) return null;
    const row = auction as {
      id: number;
      name: string | null;
      status?: string | null;
      competition_id: number | null;
    };

    const [competitionRes, countRes, access] = await Promise.all([
      row.competition_id
        ? admin.from("competitions").select("name").eq("id", row.competition_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("auction_users")
        .select("id", { count: "exact", head: true })
        .eq("auction_id", auctionId),
      getAuctionAccess(auctionId, null),
    ]);

    const inLobby = row.status === "setup";
    return {
      id: row.id,
      name: (row.name ?? "").trim() || `Auction #${auctionId}`,
      competitionName:
        ((competitionRes.data as { name?: string | null } | null)?.name ?? null) || null,
      managerCount: "count" in countRes && typeof countRes.count === "number" ? countRes.count : 0,
      publicView: access.kind !== "none" && !inLobby,
    };
  },
);
