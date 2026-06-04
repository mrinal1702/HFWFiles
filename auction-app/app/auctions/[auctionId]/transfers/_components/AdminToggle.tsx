"use client";

import { useActionState } from "react";

import { toggleAdminApprovalAction, type TransferActionState } from "@/app/auctions/[auctionId]/transfers/actions";

export function AdminToggle({
  auctionId,
  currentValue,
}: {
  auctionId: number;
  currentValue: boolean;
}) {
  const [state, formAction, pending] = useActionState<TransferActionState, FormData>(
    toggleAdminApprovalAction,
    null,
  );

  return (
    <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Admin controls</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-700">
          Require admin approval for all transfers:{" "}
          <span className={`font-semibold ${currentValue ? "text-violet-700" : "text-slate-500"}`}>
            {currentValue ? "ON" : "OFF"}
          </span>
        </span>
        <form action={formAction} className="flex gap-2">
          <input type="hidden" name="auction_id" value={auctionId} />
          <input type="hidden" name="require_approval" value={String(!currentValue)} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            {pending ? "…" : currentValue ? "Turn OFF" : "Turn ON"}
          </button>
        </form>
      </div>
      {state && (
        <p
          role="status"
          className={`mt-2 text-sm ${state.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
