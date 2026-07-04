"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/get-user";
import { assertActiveParticipant } from "@/lib/relegated-guard";
import { createAdminClient } from "@/lib/supabase-server";
import { transferErrorMessage } from "@/lib/transfer-messages";
import {
  adminApproveTransfer,
  adminRejectTransfer,
  cancelTransfer,
  confirmTransfer,
  proposeTransfer,
  rejectTransfer,
  respondToTransfer,
} from "@/lib/transfers";

export type TransferActionState =
  | { ok: true; message: string }
  | { ok: false; message: string }
  | null;

// ---------------------------------------------------------------------------
// Helper: resolve the caller's auction_user_id for an auction
// ---------------------------------------------------------------------------
async function resolveAuctionUserId(
  auctionId: number,
): Promise<{ auctionUserId: number } | { error: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createAdminClient();
  const { data: seat, error } = await admin
    .from("auction_users")
    .select("id, is_relegated")
    .eq("auction_id", auctionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { error: "Could not load your seat in this auction." };
  if (!seat) return { error: "You're not a participant in this auction." };

  const active = await assertActiveParticipant(auctionId, Number((seat as { id: number }).id));
  if (!active.ok) return { error: active.message };

  return { auctionUserId: Number((seat as { id: number }).id) };
}

function revalidateAuction(auctionId: number) {
  revalidatePath("/auctions", "layout");
  revalidatePath(`/auctions/${auctionId}`, "layout");
}

// ---------------------------------------------------------------------------
// proposeTransferAction
// ---------------------------------------------------------------------------
export async function proposeTransferAction(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const auctionId = Number(formData.get("auction_id"));
  const recipientId = Number(formData.get("recipient_id"));
  const cashRaw = formData.get("proposer_cash");
  const cash = cashRaw != null && String(cashRaw).trim() !== "" ? Number(cashRaw) : 0;
  const playerIds = formData.getAll("proposer_player_ids").map(String).filter(Boolean);

  if (!Number.isFinite(auctionId) || auctionId <= 0)
    return { ok: false, message: "Invalid auction." };
  if (!Number.isFinite(recipientId) || recipientId <= 0)
    return { ok: false, message: "Select a team to propose to." };
  if (!Number.isFinite(cash) || !Number.isInteger(cash) || cash < 0)
    return { ok: false, message: "Cash must be a whole number (0 or more)." };

  const resolved = await resolveAuctionUserId(auctionId);
  if ("error" in resolved) return { ok: false, message: resolved.error };

  if (resolved.auctionUserId === recipientId)
    return { ok: false, message: "You can't propose a transfer to yourself." };

  const admin = createAdminClient();
  const { data, rpcError } = await proposeTransfer(admin, {
    auctionId,
    proposerId: resolved.auctionUserId,
    recipientId,
    proposerPlayerIds: playerIds,
    proposerCash: Math.floor(cash),
  });

  revalidateAuction(auctionId);

  if (rpcError) return { ok: false, message: "Couldn't submit transfer. Try again." };
  if (!data) return { ok: false, message: "No response. Try again." };
  if (!data.ok) return { ok: false, message: transferErrorMessage((data as { ok: false; error: string }).error) };

  return { ok: true, message: "Transfer proposed! The other manager will see it on their Transfers page." };
}

// ---------------------------------------------------------------------------
// respondToTransferAction
// ---------------------------------------------------------------------------
export async function respondToTransferAction(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const auctionId = Number(formData.get("auction_id"));
  const transferId = String(formData.get("transfer_id") ?? "").trim();
  const cashRaw = formData.get("recipient_cash");
  const cash = cashRaw != null && String(cashRaw).trim() !== "" ? Number(cashRaw) : 0;
  const playerIds = formData.getAll("recipient_player_ids").map(String).filter(Boolean);

  if (!Number.isFinite(auctionId) || auctionId <= 0)
    return { ok: false, message: "Invalid auction." };
  if (!transferId) return { ok: false, message: "Invalid transfer." };
  if (!Number.isFinite(cash) || !Number.isInteger(cash) || cash < 0)
    return { ok: false, message: "Cash must be a whole number (0 or more)." };

  const resolved = await resolveAuctionUserId(auctionId);
  if ("error" in resolved) return { ok: false, message: resolved.error };

  const admin = createAdminClient();
  const { data, rpcError } = await respondToTransfer(admin, {
    transferId,
    auctionUserId: resolved.auctionUserId,
    recipientPlayerIds: playerIds,
    recipientCash: Math.floor(cash),
  });

  revalidateAuction(auctionId);

  if (rpcError) return { ok: false, message: "Couldn't submit your offer. Try again." };
  if (!data) return { ok: false, message: "No response. Try again." };
  if (!data.ok) return { ok: false, message: transferErrorMessage((data as { ok: false; error: string }).error) };

  return { ok: true, message: "Offer sent! Both parties now need to confirm." };
}

// ---------------------------------------------------------------------------
// confirmTransferAction
// ---------------------------------------------------------------------------
export async function confirmTransferAction(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const auctionId = Number(formData.get("auction_id"));
  const transferId = String(formData.get("transfer_id") ?? "").trim();

  if (!Number.isFinite(auctionId) || auctionId <= 0)
    return { ok: false, message: "Invalid auction." };
  if (!transferId) return { ok: false, message: "Invalid transfer." };

  const resolved = await resolveAuctionUserId(auctionId);
  if ("error" in resolved) return { ok: false, message: resolved.error };

  const admin = createAdminClient();
  const { data, rpcError } = await confirmTransfer(admin, {
    transferId,
    auctionUserId: resolved.auctionUserId,
  });

  revalidateAuction(auctionId);

  if (rpcError) return { ok: false, message: "Couldn't confirm. Try again." };
  if (!data) return { ok: false, message: "No response. Try again." };
  if (!data.ok) return { ok: false, message: transferErrorMessage((data as { ok: false; error: string }).error) };

  const success = data as { ok: true; waiting_for_other_party?: boolean; pending_admin?: boolean };
  if (success.pending_admin) return { ok: true, message: "Confirmed! Waiting for admin approval." };
  if (success.waiting_for_other_party) return { ok: true, message: "Confirmed! Waiting for the other manager to confirm." };
  return { ok: true, message: "Transfer completed! Both squads and budgets have been updated." };
}

// ---------------------------------------------------------------------------
// cancelTransferAction
// ---------------------------------------------------------------------------
export async function cancelTransferAction(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const auctionId = Number(formData.get("auction_id"));
  const transferId = String(formData.get("transfer_id") ?? "").trim();

  if (!Number.isFinite(auctionId) || auctionId <= 0)
    return { ok: false, message: "Invalid auction." };
  if (!transferId) return { ok: false, message: "Invalid transfer." };

  const resolved = await resolveAuctionUserId(auctionId);
  if ("error" in resolved) return { ok: false, message: resolved.error };

  const admin = createAdminClient();
  const { data, rpcError } = await cancelTransfer(admin, {
    transferId,
    auctionUserId: resolved.auctionUserId,
  });

  revalidateAuction(auctionId);

  if (rpcError) return { ok: false, message: "Couldn't cancel. Try again." };
  if (!data) return { ok: false, message: "No response. Try again." };
  if (!data.ok) return { ok: false, message: transferErrorMessage((data as { ok: false; error: string }).error) };

  return { ok: true, message: "Transfer cancelled." };
}

// ---------------------------------------------------------------------------
// rejectTransferAction
// ---------------------------------------------------------------------------
export async function rejectTransferAction(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const auctionId = Number(formData.get("auction_id"));
  const transferId = String(formData.get("transfer_id") ?? "").trim();

  if (!Number.isFinite(auctionId) || auctionId <= 0)
    return { ok: false, message: "Invalid auction." };
  if (!transferId) return { ok: false, message: "Invalid transfer." };

  const resolved = await resolveAuctionUserId(auctionId);
  if ("error" in resolved) return { ok: false, message: resolved.error };

  const admin = createAdminClient();
  const { data, rpcError } = await rejectTransfer(admin, {
    transferId,
    auctionUserId: resolved.auctionUserId,
  });

  revalidateAuction(auctionId);

  if (rpcError) return { ok: false, message: "Couldn't reject. Try again." };
  if (!data) return { ok: false, message: "No response. Try again." };
  if (!data.ok) return { ok: false, message: transferErrorMessage((data as { ok: false; error: string }).error) };

  return { ok: true, message: "Transfer rejected." };
}

// ---------------------------------------------------------------------------
// adminApproveTransferAction (service-role only, guarded in server component)
// ---------------------------------------------------------------------------
export async function adminApproveTransferAction(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const auctionId = Number(formData.get("auction_id"));
  const transferId = String(formData.get("transfer_id") ?? "").trim();

  const user = await getAuthUser();
  const isAdmin = user?.email === (process.env.ADMIN_EMAIL ?? "");
  if (!isAdmin) return { ok: false, message: "Not authorised." };

  const admin = createAdminClient();
  const { data, rpcError } = await adminApproveTransfer(admin, { transferId });

  revalidateAuction(auctionId);

  if (rpcError) return { ok: false, message: "Couldn't approve. Try again." };
  if (!data) return { ok: false, message: "No response. Try again." };
  if (!data.ok) return { ok: false, message: transferErrorMessage((data as { ok: false; error: string }).error) };

  return { ok: true, message: "Transfer approved and executed." };
}

// ---------------------------------------------------------------------------
// adminRejectTransferAction
// ---------------------------------------------------------------------------
export async function adminRejectTransferAction(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const auctionId = Number(formData.get("auction_id"));
  const transferId = String(formData.get("transfer_id") ?? "").trim();

  const user = await getAuthUser();
  const isAdmin = user?.email === (process.env.ADMIN_EMAIL ?? "");
  if (!isAdmin) return { ok: false, message: "Not authorised." };

  const admin = createAdminClient();
  const { data, rpcError } = await adminRejectTransfer(admin, { transferId });

  revalidateAuction(auctionId);

  if (rpcError) return { ok: false, message: "Couldn't reject. Try again." };
  if (!data) return { ok: false, message: "No response. Try again." };
  if (!data.ok) return { ok: false, message: transferErrorMessage((data as { ok: false; error: string }).error) };

  return { ok: true, message: "Transfer rejected." };
}

// ---------------------------------------------------------------------------
// toggleAdminApprovalAction — set transfers_require_admin_approval on an auction
// ---------------------------------------------------------------------------
export async function toggleAdminApprovalAction(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const auctionId = Number(formData.get("auction_id"));
  const value = formData.get("require_approval") === "true";

  const user = await getAuthUser();
  const isAdmin = user?.email === (process.env.ADMIN_EMAIL ?? "");
  if (!isAdmin) return { ok: false, message: "Not authorised." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("Auctions")
    .update({ transfers_require_admin_approval: value })
    .eq("id", auctionId);

  revalidateAuction(auctionId);

  if (error) return { ok: false, message: "Couldn't update setting. Try again." };
  return {
    ok: true,
    message: value ? "Admin approval enabled for all transfers." : "Admin approval disabled.",
  };
}
