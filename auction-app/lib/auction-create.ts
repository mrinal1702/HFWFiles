import "server-only";

import { AUCTION_NAME_MAX, AUCTION_NAME_MIN } from "@/lib/auction-create-constants";
import { createAdminClient } from "@/lib/supabase-server";

export { AUCTION_NAME_MAX, AUCTION_NAME_MIN };

/**
 * Self-serve "Create auction" rules (HFW Self-Sufficiency, Oct 2026).
 *
 * - Only UEFA CL 2026/27 is offered for now.
 * - Auction names are unique forever (archived included), compared case- and
 *   space-insensitively against every online and live auction.
 * - Suggested name: "<Admin name>'s Auction N" with the lowest free N.
 */

export const CREATE_AUCTION_COMPETITION = {
  id: 4,
  name: "UEFA Champions League 2026/27",
} as const;

export type CreateAuctionRole = "play_and_admin" | "admin_only";

export function isCreateAuctionRole(v: unknown): v is CreateAuctionRole {
  return v === "play_and_admin" || v === "admin_only";
}

/** Display form: trimmed, inner whitespace collapsed. */
export function tidyAuctionName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Comparison key: tidy + lower-case, so "Mrinal's  auction 1" clashes with "Mrinal's Auction 1". */
export function auctionNameKey(raw: string): string {
  return tidyAuctionName(raw).toLowerCase();
}

/** Format problems with a name (null when fine). Uniqueness is checked separately. */
export function auctionNameFormatError(raw: string): string | null {
  const name = tidyAuctionName(raw);
  if (name.length < AUCTION_NAME_MIN) return `Give your auction a name of at least ${AUCTION_NAME_MIN} characters.`;
  if (name.length > AUCTION_NAME_MAX) return `Keep the name to ${AUCTION_NAME_MAX} characters or fewer.`;
  return null;
}

/** Every auction name ever used (online + live), as comparison keys. Tiny tables — load all. */
export async function loadTakenAuctionNameKeys(): Promise<Set<string>> {
  const admin = createAdminClient();
  const [online, live] = await Promise.all([
    admin.from("Auctions").select("name"),
    admin.from("live_auctions").select("name"),
  ]);
  if (online.error) throw new Error(`Auctions: ${online.error.message}`);
  if (live.error) throw new Error(`live_auctions: ${live.error.message}`);
  const keys = new Set<string>();
  for (const r of [...(online.data ?? []), ...(live.data ?? [])] as { name: string | null }[]) {
    if (r.name) keys.add(auctionNameKey(r.name));
  }
  return keys;
}

export async function isAuctionNameTaken(raw: string): Promise<boolean> {
  return (await loadTakenAuctionNameKeys()).has(auctionNameKey(raw));
}

/** "<Name>'s Auction N" with the lowest N not yet taken. */
export function suggestAuctionName(displayName: string, taken: Set<string>): string {
  const base = tidyAuctionName(displayName) || "My";
  const owner = base === "My" ? "My" : `${base}'s`;
  for (let n = 1; ; n += 1) {
    const candidate = `${owner} Auction ${n}`;
    if (!taken.has(auctionNameKey(candidate))) return candidate;
  }
}

/** Display name used across the app: profiles.display_name, else the email prefix. */
export async function loadCreatorDisplayName(user: { id: string; email?: string | null }): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  return (
    (data as { display_name?: string | null } | null)?.display_name?.trim() ||
    user.email?.split("@")[0] ||
    "Player"
  );
}
