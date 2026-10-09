import "server-only";

import { AUCTION_NAME_MAX, AUCTION_NAME_MIN } from "@/lib/auction-create-constants";
import { JOIN_DEFAULT_BUDGET } from "@/lib/join-constants";
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

/** Starting budget for every manager seat (creator's own seat and anyone joining by code). */
export const STARTING_BUDGET = JOIN_DEFAULT_BUDGET;
/** Seats per self-serve auction (the join action caps at 32). */
export const SELF_SERVE_MAX_PARTICIPANTS = 16;
/** A commissioner may have at most this many auctions still in the lobby. */
export const MAX_OPEN_LOBBIES = 3;

const CREATE_ERRORS: Record<string, string> = {
  not_authenticated: "You must be logged in.",
  invalid_name: `Give your auction a name of ${AUCTION_NAME_MIN}–${AUCTION_NAME_MAX} characters.`,
  name_taken: "That name is already taken — auction names are unique. Try another.",
  competition_unavailable: "That competition isn't open for new auctions.",
  too_many_open_lobbies: `You already have ${MAX_OPEN_LOBBIES} auctions waiting to start. Start bidding in one of those first.`,
  join_code_exhausted: "We couldn't generate a join code. Please try again.",
};

export type CreatedAuction = { auctionId: number; joinCode: string; name: string };

/** Creates the auction (+ the creator's seat when they play) in one transaction. */
export async function createSelfServeAuction(params: {
  creatorId: string;
  name: string;
  play: boolean;
  seatName: string;
}): Promise<{ ok: true; auction: CreatedAuction } | { ok: false; message: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_self_serve_auction", {
    p_creator: params.creatorId,
    p_name: params.name,
    p_play: params.play,
    p_competition_id: CREATE_AUCTION_COMPETITION.id,
    p_seat_name: params.seatName,
    p_starting_budget: STARTING_BUDGET,
    p_max_participants: SELF_SERVE_MAX_PARTICIPANTS,
    p_max_open_lobbies: MAX_OPEN_LOBBIES,
  });
  if (error) {
    console.error("[createSelfServeAuction] RPC error:", error.message);
    return { ok: false, message: "We couldn't create the auction. Please try again." };
  }
  const res = data as { ok: boolean; error?: string; auction_id?: number; join_code?: string; name?: string };
  if (!res.ok) {
    return { ok: false, message: CREATE_ERRORS[res.error ?? ""] ?? "We couldn't create the auction. Please try again." };
  }
  return { ok: true, auction: { auctionId: Number(res.auction_id), joinCode: String(res.join_code), name: String(res.name) } };
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
