import "server-only";

import { createAdminClient } from "@/lib/supabase-server";
import { isGoalkeeperPosition, positionSortRank } from "@/lib/auction-state/bid-ui-messages";
import { isArchivedCompetition, loadArchivedCompetitionIds } from "@/lib/archived-auctions";

/**
 * Online-auction admin (commissioner) helpers.
 *
 * The admin for an online auction is a single auth user stored on
 * `Auctions.admin_user_id` (added by scripts/sql/auction-admin-column.sql).
 * This is independent of being a participant (an `auction_users` seat) — a
 * person can be admin-only, participant-only, or both.
 */

/** Returns the admin auth-user id for an auction, or null if none / column missing. */
export async function getAuctionAdminUserId(auctionId: number): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("Auctions")
    .select("admin_user_id")
    .eq("id", auctionId)
    .maybeSingle();

  if (error) {
    // Column not applied yet (auction-admin-column.sql not run) — treat as "no admin".
    if (String(error.message).includes("admin_user_id")) return null;
    throw new Error(`Auctions.admin_user_id: ${error.message}`);
  }
  return (data as { admin_user_id?: string | null } | null)?.admin_user_id ?? null;
}

/** True when the given auth user is the configured admin for this auction. */
export async function userIsAuctionAdmin(
  auctionId: number,
  authUserId: string | null,
): Promise<boolean> {
  if (!authUserId) return false;
  const adminUserId = await getAuctionAdminUserId(auctionId);
  return adminUserId != null && adminUserId === authUserId;
}

/** Returns an error string when the user is not the admin, or null when authorized. */
export async function requireAuctionAdmin(
  auctionId: number,
  authUserId: string | null,
): Promise<string | null> {
  const ok = await userIsAuctionAdmin(auctionId, authUserId);
  if (!ok) return "Not authorized — you are not the admin for this auction.";
  return null;
}

export type AdminAuctionRow = { id: number; name: string | null };

/**
 * Active (non-archived) online auctions where this user is the configured admin.
 * Independent of participation — surfaces the dashboard "Admin - <Auction>" links.
 * Returns [] when the admin_user_id column has not been applied yet.
 */
export async function loadMyAdminAuctionsForUser(authUserId: string): Promise<AdminAuctionRow[]> {
  if (!authUserId) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("Auctions")
    .select("id, name, admin_user_id, competition_id")
    .eq("admin_user_id", authUserId)
    .order("id", { ascending: false });

  if (error) {
    if (String(error.message).includes("admin_user_id")) return [];
    throw new Error(`Auctions(admin): ${error.message}`);
  }

  const archivedCompetitionIds = await loadArchivedCompetitionIds();
  return ((data ?? []) as { id: number; name: string | null; competition_id: number | null }[])
    .filter((r) => !isArchivedCompetition(r.competition_id, archivedCompetitionIds))
    .map((r) => ({ id: r.id, name: r.name }));
}

/** Display name for the admin, from profiles.display_name (falls back to "Admin"). */
export async function getAdminDisplayName(authUserId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", authUserId)
    .maybeSingle();
  if (error) return "Admin";
  const name = (data as { display_name?: string | null } | null)?.display_name ?? "";
  return name.trim() || "Admin";
}

// ─── Position grouping (mirrors the participant "My team" view) ───────────────

export type SquadSectionId = "gk" | "def" | "mid" | "fwd" | "other";

export const SQUAD_SECTION_ORDER: Array<{ id: SquadSectionId; label: string }> = [
  { id: "gk", label: "Goalkeepers" },
  { id: "def", label: "Defenders" },
  { id: "mid", label: "Midfielders" },
  { id: "fwd", label: "Forwards" },
  { id: "other", label: "Other" },
];

export function squadSectionForPosition(position: string | null | undefined): SquadSectionId {
  const p = (position ?? "").trim().toLowerCase();
  if (p === "gk" || p.includes("goalkeeper")) return "gk";
  if (p.includes("defend")) return "def";
  if (p.includes("midfield")) return "mid";
  if (p.includes("forward")) return "fwd";
  return "other";
}

export { isGoalkeeperPosition, positionSortRank };
