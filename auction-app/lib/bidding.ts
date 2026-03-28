import type { SupabaseClient } from "@supabase/supabase-js";

export type PlaceBidParams = {
  auctionId: number;
  playerId: string;
  auctionUserId: number;
  amount: number;
};

/** Error codes returned in JSON from public.place_bid (see scripts/sql/auction-bidding.sql). */
export type PlaceBidErrorCode =
  | "amount_must_be_integer"
  | "below_minimum_opening_bid"
  | "auction_not_found"
  | "hard_deadline_not_set"
  | "auction_deadline_passed"
  | "lot_not_found"
  | "lot_not_biddable"
  | "bid_too_low"
  | "bid_increment_too_small"
  | "bidder_not_in_auction"
  | "roster_full"
  | "goalkeeper_cap"
  | "outfield_cap"
  | "insufficient_active_budget";

export type PlaceBidSuccess = {
  ok: true;
  bid_id: number;
  expires_at: string;
};

export type PlaceBidFailure = {
  ok: false;
  error: PlaceBidErrorCode;
};

export type PlaceBidResult = PlaceBidSuccess | PlaceBidFailure;

/** Error codes from public.finalize_auction_hard_deadline JSON (Postgres exceptions surface via rpcError). */
export type FinalizeAuctionErrorCode =
  | "auction_not_found"
  | "hard_deadline_not_set"
  | "deadline_not_reached";

export type FinalizeAuctionSuccess = {
  ok: true;
  lots_sold: number;
  lots_unsold: number;
  hard_deadline_at: string;
};

export type FinalizeAuctionFailure = {
  ok: false;
  error: FinalizeAuctionErrorCode;
};

export type FinalizeAuctionResult = FinalizeAuctionSuccess | FinalizeAuctionFailure;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Single round-trip to Postgres: validates rules, locks rows, inserts bid, updates lot + budgets.
 * Prefer a service-role client from a trusted server route or admin script (no auth yet).
 */
export async function placeBid(
  supabase: SupabaseClient,
  params: PlaceBidParams,
): Promise<{ data: PlaceBidResult | null; rpcError: Error | null }> {
  const { data, error } = await supabase.rpc("place_bid", {
    p_auction_id: params.auctionId,
    p_player_id: params.playerId,
    p_auction_user_id: params.auctionUserId,
    p_amount: params.amount,
  });

  if (error) {
    return { data: null, rpcError: error };
  }

  if (!isRecord(data)) {
    return { data: null, rpcError: new Error("place_bid returned non-object") };
  }

  const ok = data.ok === true;
  if (!ok) {
    return {
      data: { ok: false, error: String(data.error ?? "unknown") as PlaceBidErrorCode },
      rpcError: null,
    };
  }

  return {
    data: {
      ok: true,
      bid_id: Number(data.bid_id),
      expires_at: String(data.expires_at ?? ""),
    },
    rpcError: null,
  };
}

/**
 * Run after the auction hard deadline: sells every lot that has a high bid, marks no-bid lots unsold,
 * sets active_budget = budget_remaining for all users in the auction.
 * Pass force: true to run before the deadline (admin / dry runs only).
 */
export async function finalizeAuctionHardDeadline(
  supabase: SupabaseClient,
  params: { auctionId: number; force?: boolean },
): Promise<{ data: FinalizeAuctionResult | null; rpcError: Error | null }> {
  const { data, error } = await supabase.rpc("finalize_auction_hard_deadline", {
    p_auction_id: params.auctionId,
    p_force: params.force ?? false,
  });

  if (error) {
    return { data: null, rpcError: error };
  }

  if (!isRecord(data)) {
    return { data: null, rpcError: new Error("finalize_auction_hard_deadline returned non-object") };
  }

  if (data.ok !== true) {
    return {
      data: { ok: false, error: String(data.error ?? "unknown") as FinalizeAuctionErrorCode },
      rpcError: null,
    };
  }

  return {
    data: {
      ok: true,
      lots_sold: Number(data.lots_sold ?? 0),
      lots_unsold: Number(data.lots_unsold ?? 0),
      hard_deadline_at: String(data.hard_deadline_at ?? ""),
    },
    rpcError: null,
  };
}
