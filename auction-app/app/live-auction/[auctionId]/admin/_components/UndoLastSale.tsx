"use client";

import { useActionState } from "react";

import type { SaleWithDetails, VoidSaleState } from "@/lib/live-auction-types";

type Props = {
  lastSale: SaleWithDetails | null;
  voidSale: (prevState: VoidSaleState, formData: FormData) => Promise<VoidSaleState>;
};

export function UndoLastSale({ lastSale, voidSale }: Props) {
  const [state, formAction, pending] = useActionState(voidSale, null);

  if (!lastSale) return null;

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 shadow-sm">
      <form action={formAction} className="flex flex-wrap items-center justify-between gap-3">
        <input type="hidden" name="saleId" value={lastSale.id} />
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">Last sale:</span>{" "}
          {lastSale.player_name}{" "}
          <span className="text-slate-500">→</span>{" "}
          {lastSale.participant_name}{" "}
          <span className="font-mono font-semibold text-slate-900">(£{lastSale.price})</span>
        </p>
        <div className="flex items-center gap-3">
          {state?.error && (
            <span className="text-xs text-red-600">{state.error}</span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            {pending ? "Undoing…" : "↩ Undo"}
          </button>
        </div>
      </form>
    </div>
  );
}
