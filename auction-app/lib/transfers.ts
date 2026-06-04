import type { SupabaseClient } from "@supabase/supabase-js";

export type TransferStatus =
  | "awaiting_response"
  | "awaiting_confirmation"
  | "pending_admin"
  | "completed"
  | "rejected"
  | "cancelled";

export type AuctionTransfer = {
  id: string;
  auction_id: number;
  proposer_id: number;
  recipient_id: number;
  proposer_player_ids: string[];
  proposer_cash: number;
  recipient_player_ids: string[];
  recipient_cash: number;
  status: TransferStatus;
  proposer_confirmed: boolean;
  recipient_confirmed: boolean;
  admin_approved: boolean | null;
  summary: string | null;
  created_at: string;
  completed_at: string | null;
};

export type PlayerMeta = {
  player_id: string;
  player_name: string | null;
  position: string | null;
};

export type EnrichedTransfer = AuctionTransfer & {
  proposer_name: string | null;
  recipient_name: string | null;
  proposer_players: PlayerMeta[];
  recipient_players: PlayerMeta[];
};

export type TransferErrorCode =
  | "auction_not_found"
  | "transfer_deadline_passed"
  | "proposer_not_in_auction"
  | "recipient_not_in_auction"
  | "cannot_transfer_to_self"
  | "must_offer_something"
  | "player_not_owned_by_proposer"
  | "player_not_owned_by_recipient"
  | "player_already_in_transfer"
  | "proposer_insufficient_funds"
  | "recipient_insufficient_funds"
  | "transfer_not_found"
  | "transfer_not_awaiting_response"
  | "transfer_not_awaiting_confirmation"
  | "transfer_not_pending_admin"
  | "not_the_recipient"
  | "not_a_participant"
  | "only_proposer_can_cancel"
  | "only_recipient_can_reject"
  | "transfer_already_closed"
  | "already_confirmed"
  | "proposer_squad_size_exceeded"
  | "recipient_squad_size_exceeded"
  | "proposer_goalkeeper_limit_exceeded"
  | "recipient_goalkeeper_limit_exceeded"
  | "invalid_cash_amount"
  | string;

export type TransferSuccess = {
  ok: true;
  transfer_id?: string;
  summary?: string;
  waiting_for_other_party?: boolean;
  pending_admin?: boolean;
};

export type TransferFailure = { ok: false; error: TransferErrorCode };
export type TransferResult = TransferSuccess | TransferFailure;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function callRpc(
  supabase: SupabaseClient,
  rpcName: string,
  params: Record<string, unknown>,
): Promise<{ data: TransferResult | null; rpcError: Error | null }> {
  const { data, error } = await supabase.rpc(rpcName, params);
  if (error) return { data: null, rpcError: error };
  if (!isRecord(data)) return { data: null, rpcError: new Error(`${rpcName} returned non-object`) };
  if (data.ok !== true) {
    return {
      data: { ok: false, error: String(data.error ?? "unknown") as TransferErrorCode },
      rpcError: null,
    };
  }
  return { data: { ok: true, ...data } as TransferSuccess, rpcError: null };
}

export function proposeTransfer(
  supabase: SupabaseClient,
  params: {
    auctionId: number;
    proposerId: number;
    recipientId: number;
    proposerPlayerIds: string[];
    proposerCash: number;
  },
) {
  return callRpc(supabase, "propose_transfer", {
    p_auction_id: params.auctionId,
    p_proposer_id: params.proposerId,
    p_recipient_id: params.recipientId,
    p_proposer_player_ids: params.proposerPlayerIds,
    p_proposer_cash: params.proposerCash,
  });
}

export function respondToTransfer(
  supabase: SupabaseClient,
  params: {
    transferId: string;
    auctionUserId: number;
    recipientPlayerIds: string[];
    recipientCash: number;
  },
) {
  return callRpc(supabase, "respond_to_transfer", {
    p_transfer_id: params.transferId,
    p_auction_user_id: params.auctionUserId,
    p_recipient_player_ids: params.recipientPlayerIds,
    p_recipient_cash: params.recipientCash,
  });
}

export function confirmTransfer(
  supabase: SupabaseClient,
  params: { transferId: string; auctionUserId: number },
) {
  return callRpc(supabase, "confirm_transfer", {
    p_transfer_id: params.transferId,
    p_auction_user_id: params.auctionUserId,
  });
}

export function cancelTransfer(
  supabase: SupabaseClient,
  params: { transferId: string; auctionUserId: number },
) {
  return callRpc(supabase, "cancel_transfer", {
    p_transfer_id: params.transferId,
    p_auction_user_id: params.auctionUserId,
  });
}

export function rejectTransfer(
  supabase: SupabaseClient,
  params: { transferId: string; auctionUserId: number },
) {
  return callRpc(supabase, "reject_transfer", {
    p_transfer_id: params.transferId,
    p_auction_user_id: params.auctionUserId,
  });
}

export function adminApproveTransfer(
  supabase: SupabaseClient,
  params: { transferId: string },
) {
  return callRpc(supabase, "admin_approve_transfer", {
    p_transfer_id: params.transferId,
  });
}

export function adminRejectTransfer(
  supabase: SupabaseClient,
  params: { transferId: string },
) {
  return callRpc(supabase, "admin_reject_transfer", {
    p_transfer_id: params.transferId,
  });
}

export function voidExpiredTransfers(
  supabase: SupabaseClient,
  params: { auctionId: number },
) {
  return callRpc(supabase, "void_expired_transfers", {
    p_auction_id: params.auctionId,
  });
}

/**
 * Loads and enriches all transfers for a given auction.
 * Returns active (non-terminal) transfers and history (terminal) separately.
 */
export async function loadTransfersForAuction(
  supabase: SupabaseClient,
  auctionId: number,
): Promise<{ active: EnrichedTransfer[]; history: EnrichedTransfer[] }> {
  const { data: raw, error } = await supabase
    .from("auction_transfers")
    .select("*")
    .eq("auction_id", auctionId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`auction_transfers: ${error.message}`);
  const transfers = (raw ?? []) as AuctionTransfer[];

  if (transfers.length === 0) return { active: [], history: [] };

  // Gather all player ids and user ids we need to enrich
  const allPlayerIds = [
    ...new Set([
      ...transfers.flatMap((t) => t.proposer_player_ids),
      ...transfers.flatMap((t) => t.recipient_player_ids),
    ]),
  ].filter(Boolean);

  const allUserIds = [
    ...new Set(transfers.flatMap((t) => [t.proposer_id, t.recipient_id])),
  ];

  const [playersRes, usersRes] = await Promise.all([
    allPlayerIds.length
      ? supabase
          .from("players")
          .select("player_id, player_name, position")
          .in("player_id", allPlayerIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("auction_users")
      .select("id, name")
      .in("id", allUserIds),
  ]);

  if (playersRes.error) throw new Error(`players: ${playersRes.error.message}`);
  if (usersRes.error) throw new Error(`auction_users: ${usersRes.error.message}`);

  const playerById = new Map<string, PlayerMeta>();
  for (const p of playersRes.data ?? []) {
    const row = p as { player_id: string; player_name: string | null; position: string | null };
    playerById.set(String(row.player_id), {
      player_id: String(row.player_id),
      player_name: row.player_name,
      position: row.position,
    });
  }

  const userById = new Map<number, string | null>();
  for (const u of usersRes.data ?? []) {
    const row = u as { id: number; name: string | null };
    userById.set(row.id, row.name);
  }

  const enrich = (t: AuctionTransfer): EnrichedTransfer => ({
    ...t,
    proposer_name: userById.get(t.proposer_id) ?? null,
    recipient_name: userById.get(t.recipient_id) ?? null,
    proposer_players: t.proposer_player_ids
      .map((id) => playerById.get(id) ?? { player_id: id, player_name: null, position: null }),
    recipient_players: t.recipient_player_ids
      .map((id) => playerById.get(id) ?? { player_id: id, player_name: null, position: null }),
  });

  const terminal = new Set(["completed", "rejected", "cancelled"]);
  const active = transfers.filter((t) => !terminal.has(t.status)).map(enrich);
  const history = transfers.filter((t) => terminal.has(t.status)).map(enrich);

  return { active, history };
}
