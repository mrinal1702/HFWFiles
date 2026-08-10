import { cache } from "react";

import {
  loadAuctionHistoryForUser,
  type AuctionHistoryEntry,
} from "@/lib/auction-history";
import { createAdminClient } from "@/lib/supabase-server";

/** Strict public fields for another signed-in user's HFW profile. */
export type PublicProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  finishes: AuctionHistoryEntry[];
};

/**
 * Load display_name + avatar_url + archived finishes for any auth user id.
 * Service-role + field allowlist (no email or private settings).
 */
export const loadPublicProfile = cache(
  async (userId: string): Promise<PublicProfile | null> => {
    const id = userId.trim();
    if (!id) return null;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (String(error.message).includes("avatar_url")) {
        const fallback = await admin
          .from("profiles")
          .select("id, display_name")
          .eq("id", id)
          .maybeSingle();
        if (fallback.error) throw new Error(`profiles: ${fallback.error.message}`);
        if (!fallback.data) return null;
        const finishes = await loadAuctionHistoryForUser(id);
        return {
          id: String((fallback.data as { id: string }).id),
          displayName:
            ((fallback.data as { display_name: string | null }).display_name ?? "").trim() ||
            "HFW member",
          avatarUrl: null,
          finishes,
        };
      }
      throw new Error(`profiles: ${error.message}`);
    }
    if (!data) return null;

    const row = data as {
      id: string;
      display_name: string | null;
      avatar_url: string | null;
    };
    const finishes = await loadAuctionHistoryForUser(id);

    return {
      id: String(row.id),
      displayName: (row.display_name ?? "").trim() || "HFW member",
      avatarUrl: row.avatar_url?.trim() || null,
      finishes,
    };
  },
);
