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
import { transferStatusColor, transferStatusLabel } from "@/lib/auction-state/transfer-messages";
import type { EnrichedTransfer } from "@/lib/auction-state/transfers";
import { LocalTime } from "@/app/auctions/_components/LocalTime";
import { DealLeg } from "./TransferHistoryCard";

function ActionButton({
  label,
  pending,
  variant,
}: {
  label: string;
  pending: boolean;
  variant: "primary" | "danger" | "ghost";
}) {
  const base =
    "min-h-10 rounded-xl px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0";
  const variants = {
    primary:
      "bg-gradient-to-r from-sky-500 to-sky-700 font-semibold text-white shadow-sm shadow-sky-200 hover:shadow-md",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
    ghost: "border border-slate-200 bg-white text-slate-700 hover:border-slate-300",
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

  // Viewer's side first (admins viewing others' deals: proposer first).
  const proposerSide = {
    name: transfer.proposer_name ?? "Proposer",
    players: transfer.proposer_players,
    cash: transfer.proposer_cash,
  };
  const recipientSide = {
    name: transfer.recipient_name ?? "Recipient",
    players: transfer.recipient_players,
    cash: transfer.recipient_cash,
  };
  const [first, second] = isRecipient ? [recipientSide, proposerSide] : [proposerSide, recipientSide];
  const involved = isProposer || isRecipient;
  const awaitingOfferText = (side: typeof first) =>
    transfer.status === "awaiting_response" && side === recipientSide
      ? `Awaiting ${recipientSide.name}'s offer`
      : "Nothing";

  return (
    <article className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 p-4 pl-5 shadow-sm sm:p-5 sm:pl-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-300 to-amber-500" />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Proposed <LocalTime iso={transfer.created_at} />
        </p>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${transferStatusColor(transfer.status)}`}
        >
          {transferStatusLabel(transfer.status)}
        </span>
      </div>

      {/* Deal legs */}
      <div className="mt-3 space-y-2.5">
        <DealLeg
          from={first.name}
          to={second.name}
          players={first.players}
          cash={first.cash}
          verb="offered"
          tone={involved ? "out" : "neutral"}
          emptyText={awaitingOfferText(first)}
        />
        <DealLeg
          from={second.name}
          to={first.name}
          players={second.players}
          cash={second.cash}
          verb="offered"
          tone={involved ? "in" : "neutral"}
          emptyText={awaitingOfferText(second)}
        />
      </div>

      {/* Confirmation status */}
      {transfer.status === "awaiting_confirmation" && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
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
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Recipient: respond (awaiting_response) */}
        {isRecipient && transfer.status === "awaiting_response" && (
          <Link
            href={`/auctions/${auctionId}/transfers/${transfer.id}/respond`}
            className="inline-flex min-h-10 items-center rounded-xl bg-gradient-to-r from-sky-500 to-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-200 transition hover:-translate-y-0.5 hover:shadow-md"
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
    </article>
  );
}
