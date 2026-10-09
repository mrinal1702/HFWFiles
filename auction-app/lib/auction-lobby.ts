import "server-only";

import { fetchAuctionUsers } from "@/lib/auction-users-query";
import type { AuctionUserRow } from "@/lib/auction-types";
import { createAdminClient } from "@/lib/supabase-server";

/**
 * Lobby = a self-serve auction that exists but whose commissioner hasn't pressed
 * Start Bidding yet (Auctions.status = 'setup'). Participants wait; the admin sees
 * who has joined. Squads, bids and admin tools stay hidden until bidding starts.
 */

export type AuctionLobby = {
  auctionId: number;
  name: string;
  joinCode: string | null;
  maxParticipants: number;
  competitionId: number | null;
  adminUserId: string | null;
  adminName: string;
  members: AuctionUserRow[];
};

/** True while the auction is in the lobby. Missing column / row → false (never blocks live auctions). */
export async function isAuctionInLobby(auctionId: number): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("Auctions").select("status").eq("id", auctionId).maybeSingle();
  if (error || !data) return false;
  return (data as { status?: string | null }).status === "setup";
}

/** profiles.display_name for the commissioner (kept local to avoid importing the admin module). */
async function loadDisplayName(authUserId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("display_name").eq("id", authUserId).maybeSingle();
  return (data as { display_name?: string | null } | null)?.display_name?.trim() || "your commissioner";
}

export async function loadAuctionLobby(auctionId: number): Promise<AuctionLobby | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("Auctions")
    .select("id, name, status, join_code, max_participants, competition_id, admin_user_id")
    .eq("id", auctionId)
    .maybeSingle();
  if (error) throw new Error(`Auctions: ${error.message}`);
  if (!data) return null;
  const a = data as {
    id: number;
    name: string | null;
    status: string;
    join_code: string | null;
    max_participants: number | null;
    competition_id: number | null;
    admin_user_id: string | null;
  };
  if (a.status !== "setup") return null;

  const [members, adminName] = await Promise.all([
    fetchAuctionUsers(admin, auctionId),
    a.admin_user_id ? loadDisplayName(a.admin_user_id) : Promise.resolve("your commissioner"),
  ]);

  return {
    auctionId: a.id,
    name: a.name ?? `Auction #${a.id}`,
    joinCode: a.join_code,
    maxParticipants: Number(a.max_participants ?? 16),
    competitionId: a.competition_id,
    adminUserId: a.admin_user_id,
    adminName,
    members,
  };
}
