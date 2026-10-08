"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AdminActionState } from "../../../actions";

export type HeldBid = {
  player_id: string;
  player_name: string | null;
  position: string | null;
  club: string | null;
  amount: number | null;
};

export function CancelBidsClient({
  participantId,
  participantName,
  bids,
  cancelBid,
}: {
  participantId: number;
  participantName: string;
  bids: HeldBid[];
  cancelBid: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<HeldBid | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await cancelBid(null, formData);
      if (res?.ok) {
        setBanner(res.message ?? "Done.");
        setSelected(null);
        router.refresh();
      } else {
        setError(res?.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {banner && (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          {banner}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        {bids.length === 0 ? (
          <p className="text-sm text-slate-600">{participantName} isn&apos;t winning any bids right now.</p>
        ) : (
          <ul className="space-y-2">
            {bids.map((b, i) => (
              <li
                key={b.player_id}
                className={`flex items-center justify-between gap-3 rounded-xl border border-amber-100 px-4 py-3 shadow-sm ${
                  i % 2 === 0 ? "bg-white" : "bg-amber-50/70"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {b.player_name ?? `Player #${b.player_id}`}
                  </span>
                  <span className="block truncate text-xs text-slate-600">
                    {(b.club ?? "—") + " · " + (b.position ?? "—")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm font-medium text-slate-900">{b.amount ?? "—"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSelected(b);
                    }}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Cancel bid
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirm modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cancel"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSelected(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-sky-100 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Cancel this bid?</h3>
            <p className="mt-2 text-sm text-slate-700">
              {selected.player_name ?? "This player"} will go back to the unsold market and become
              biddable again, and £{selected.amount ?? 0} will be credited back to {participantName}&apos;s
              disposable budget.
            </p>
            <p className="mt-1 text-xs text-slate-500">The previous bid is not restored.</p>

            {error && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-4 flex justify-end gap-2">
              <input type="hidden" name="participantId" value={participantId} />
              <input type="hidden" name="playerId" value={selected.player_id} />
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Keep bid
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "Cancelling…" : "Yes, cancel bid"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
