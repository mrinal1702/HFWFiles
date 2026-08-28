"use client";

import { useActionState, useState, useEffect } from "react";

import type {
  SaleWithDetails,
  LiveAuctionParticipant,
  VoidSaleState,
  EditSaleState,
} from "@/lib/live-auction-types";

type Props = {
  sales: SaleWithDetails[];
  participants: LiveAuctionParticipant[];
  voidSale: (prevState: VoidSaleState, formData: FormData) => Promise<VoidSaleState>;
  editSale: (prevState: EditSaleState, formData: FormData) => Promise<EditSaleState>;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SalesLog({ sales, participants, voidSale, editSale }: Props) {
  // Which sale is currently open for voiding or editing (by ID)
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [voidState, voidAction, voidPending] = useActionState(voidSale, null);
  const [editState, editAction, editPending] = useActionState(editSale, null);

  // Close panels on success
  useEffect(() => {
    if (voidState?.success) setVoidingId(null);
  }, [voidState?.success]);

  useEffect(() => {
    if (editState?.success) setEditingId(null);
  }, [editState?.success]);

  const voidingSale = sales.find((s) => s.id === voidingId) ?? null;
  const editingSale = sales.find((s) => s.id === editingId) ?? null;

  return (
    <div className="space-y-4">
      {/* ── Void panel ───────────────────────────────────────────────────── */}
      {voidingSale && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-medium text-red-900">
            Void sale: {voidingSale.player_name} → {voidingSale.participant_name} (£{voidingSale.price})
          </p>
          <p className="mt-1 text-xs text-red-700">
            The player will be returned to the available pool.
          </p>
          <form action={voidAction} className="mt-3 space-y-3">
            <input type="hidden" name="saleId" value={voidingSale.id} />
            <input
              type="text"
              name="reason"
              placeholder="Reason (optional)"
              className="w-full rounded border border-red-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            {voidState?.error && (
              <p className="text-xs text-red-700">{voidState.error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={voidPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {voidPending ? "Voiding…" : "Confirm void"}
              </button>
              <button
                type="button"
                onClick={() => setVoidingId(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Edit panel ───────────────────────────────────────────────────── */}
      {editingSale && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm">
          <p className="font-medium text-sky-900">Edit sale: {editingSale.player_name}</p>
          <form action={editAction} className="mt-3 space-y-3">
            <input type="hidden" name="saleId" value={editingSale.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Price (£)</label>
                <input
                  type="number"
                  name="price"
                  defaultValue={editingSale.price}
                  min="5"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Participant</label>
                <select
                  name="participantId"
                  defaultValue={editingSale.participant_id}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                >
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {editState?.error && (
              <p className="text-xs text-red-700">{editState.error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={editPending}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {editPending ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Sales table ──────────────────────────────────────────────────── */}
      {sales.length === 0 ? (
        <p className="text-sm text-slate-500">No sales recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">Participant</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Time</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale, i) => (
                <tr
                  key={sale.id}
                  className={`border-b border-slate-100 ${
                    sale.is_voided
                      ? "opacity-40"
                      : i % 2 === 1
                        ? "bg-slate-50/60"
                        : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className={`font-medium text-slate-900 ${sale.is_voided ? "line-through" : ""}`}>
                      {sale.player_name}
                    </span>
                    {sale.is_voided && (
                      <span className="ml-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Voided{sale.void_reason ? `: ${sale.void_reason}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{sale.participant_name}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-slate-900">
                    £{sale.price}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {formatTime(sale.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!sale.is_voided && (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(sale.id === editingId ? null : sale.id);
                            setVoidingId(null);
                          }}
                          className="text-xs font-medium text-sky-700 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVoidingId(sale.id === voidingId ? null : sale.id);
                            setEditingId(null);
                          }}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Void
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
