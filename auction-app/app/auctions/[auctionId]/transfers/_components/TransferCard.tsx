"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  adminApproveTransferAction,
  adminRejectTransferAction,
  cancelTransferAction,
  confirmTransferAction,
  rejectTransferAction,
  type TransferActionState,
} from "@/app/auctions/[auctionId]/transfers/actions";
import { transferStatusColor, transferStatusLabel } from "@/lib/transfer-messages";
import type { EnrichedTransfer } from "@/lib/transfers";
import { LocalTime } from "@/app/auctions/_components/LocalTime";

function DealSide({
  players,
  cash,
  label,
}: {
  players: { player_id: string; player_name: string | null; position: string | null }[];
  cash: number;
  label: string;
}) {
  const hasPlayers = players.length > 0;
  const hasCash = cash > 0;

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {hasPlayers &&
          players.map((p) => (
            <li key={p.player_id} className="text-sm font-medium text-slate-900">
              {p.player_name ?? "—"}
              {p.position ? (
                <span className="ml-1 text-xs text-slate-500">({p.position})</span>
              ) : null}
            </li>
          ))}
        {hasCash && (
          <li className="text-sm font-medium text-slate-900">
            £{cash}m cash
          </li>
        )}
        {!hasPlayers && !hasCash && (
          <li className="text-sm italic text-slate-400">Nothing yet</li>
        )}
      </ul>
    </div>
  );
}

function ActionButton({
  label,
  pending,
  variant,
}: {
  label: string;
  pending: boolean;
  variant: "primary" | "danger" | "ghost";
}) {
  const base = "min-h-9 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50";
  const variants = {
    primary: "bg-sky-600 text-white hover:bg-sky-700",
    danger: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
    ghost: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  };
  return (
    <button type="submit" disabled={pending} className={`${base} ${variants[variant]}`}>
      {pending ? "…" : label}
    </button>
  );
}

function ActionMessage({ state }: { state: TransferActionState }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={`mt-2 text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}
    >
      {state.message}
    </p>
  );
}

export function TransferCard({
  transfer,
  meId,
  isAdmin,
  auctionId,
}: {
  transfer: EnrichedTransfer;
  meId: number;
  isAdmin: boolean;
  auctionId: number;
}) {
  const isProposer = transfer.proposer_id === meId;
  const isRecipient = transfer.recipient_id === meId;

  const [confirmState, confirmAction, confirmPending] = useActionState<TransferActionState, FormData>(
    confirmTransferAction,
    null,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState<TransferActionState, FormData>(
    cancelTransferAction,
    null,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState<TransferActionState, FormData>(
    rejectTransferAction,
    null,
  );
  const [adminApproveState, adminApproveAction, adminApprovePending] =
    useActionState<TransferActionState, FormData>(adminApproveTransferAction, null);
  const [adminRejectState, adminRejectAction, adminRejectPending] =
    useActionState<TransferActionState, FormData>(adminRejectTransferAction, null);

  const recipientHasResponded = transfer.recipient_player_ids.length > 0 || transfer.recipient_cash > 0;

  return (
    <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{transfer.proposer_name ?? "—"}</span>
          {" → "}
          <span className="font-medium text-slate-900">{transfer.recipient_name ?? "—"}</span>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${transferStatusColor(transfer.status)}`}
        >
          {transferStatusLabel(transfer.status)}
        </span>
      </div>

      {/* Deal sides */}
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:gap-4">
        <DealSide
          players={transfer.proposer_players}
          cash={transfer.proposer_cash}
          label={`${transfer.proposer_name ?? "Proposer"} offers`}
        />
        <DealSide
          players={transfer.recipient_players}
          cash={transfer.recipient_cash}
          label={
            recipientHasResponded
              ? `${transfer.recipient_name ?? "Recipient"} offers`
              : `${transfer.recipient_name ?? "Recipient"} — awaiting offer`
          }
        />
      </div>

      {/* Confirmation status */}
      {transfer.status === "awaiting_confirmation" && (
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span>
            {transfer.proposer_name ?? "Proposer"}:{" "}
            {transfer.proposer_confirmed ? (
              <span className="font-medium text-emerald-700">Confirmed ✓</span>
            ) : (
              "Pending"
            )}
          </span>
          <span>
            {transfer.recipient_name ?? "Recipient"}:{" "}
            {transfer.recipient_confirmed ? (
              <span className="font-medium text-emerald-700">Confirmed ✓</span>
            ) : (
              "Pending"
            )}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {/* Recipient: respond (awaiting_response) */}
        {isRecipient && transfer.status === "awaiting_response" && (
          <Link
            href={`/auctions/${auctionId}/transfers/${transfer.id}/respond`}
            className="min-h-9 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Respond
          </Link>
        )}

        {/* Confirm (awaiting_confirmation) */}
        {transfer.status === "awaiting_confirmation" &&
          ((isProposer && !transfer.proposer_confirmed) ||
            (isRecipient && !transfer.recipient_confirmed)) && (
            <form action={confirmAction}>
              <input type="hidden" name="auction_id" value={auctionId} />
              <input type="hidden" name="transfer_id" value={transfer.id} />
              <ActionButton label="Confirm transfer" pending={confirmPending} variant="primary" />
            </form>
          )}

        {/* Cancel (proposer, any active status) */}
        {isProposer && (
          <form action={cancelAction}>
            <input type="hidden" name="auction_id" value={auctionId} />
            <input type="hidden" name="transfer_id" value={transfer.id} />
            <ActionButton label="Cancel" pending={cancelPending} variant="ghost" />
          </form>
        )}

        {/* Reject (recipient, any active status) */}
        {isRecipient && transfer.status !== "awaiting_response" && (
          <form action={rejectAction}>
            <input type="hidden" name="auction_id" value={auctionId} />
            <input type="hidden" name="transfer_id" value={transfer.id} />
            <ActionButton label="Reject" pending={rejectPending} variant="danger" />
          </form>
        )}

        {/* Admin actions (pending_admin) */}
        {isAdmin && transfer.status === "pending_admin" && (
          <>
            <form action={adminApproveAction}>
              <input type="hidden" name="auction_id" value={auctionId} />
              <input type="hidden" name="transfer_id" value={transfer.id} />
              <ActionButton label="Approve" pending={adminApprovePending} variant="primary" />
            </form>
            <form action={adminRejectAction}>
              <input type="hidden" name="auction_id" value={auctionId} />
              <input type="hidden" name="transfer_id" value={transfer.id} />
              <ActionButton label="Reject" pending={adminRejectPending} variant="danger" />
            </form>
          </>
        )}
      </div>

      {/* Action feedback */}
      <ActionMessage state={confirmState} />
      <ActionMessage state={cancelState} />
      <ActionMessage state={rejectState} />
      <ActionMessage state={adminApproveState} />
      <ActionMessage state={adminRejectState} />

      <p className="mt-2 text-xs text-slate-400">
        Proposed <LocalTime iso={transfer.created_at} />
      </p>
    </div>
  );
}
