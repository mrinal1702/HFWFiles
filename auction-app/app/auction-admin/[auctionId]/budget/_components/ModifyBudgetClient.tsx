"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AdminActionState } from "../../actions";

export type BudgetParticipant = {
  id: number;
  name: string | null;
  team_name: string | null;
  budget_remaining: number;
  active_budget: number;
};

type Direction = "give" | "take";

const selectClass =
  "min-h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 sm:min-h-10 sm:px-3 sm:py-2";

export function ModifyBudgetClient({
  participants,
  modifyBudget,
}: {
  participants: BudgetParticipant[];
  modifyBudget: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState<{ participant: BudgetParticipant; direction: Direction } | null>(
    null,
  );
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openModal(participant: BudgetParticipant, direction: Direction) {
    setError(null);
    setTarget({ participant, direction });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await modifyBudget(null, formData);
      if (res?.ok) {
        setBanner(res.message ?? "Done.");
        setTarget(null);
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
        {participants.length === 0 ? (
          <p className="text-sm text-slate-600">No participants in this auction yet.</p>
        ) : (
          <ul className="space-y-2">
            {participants.map((p, i) => (
              <li
                key={p.id}
                className={`flex flex-col gap-3 rounded-xl border border-sky-100 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                  i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
                }`}
              >
                <div className="min-w-0 sm:flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {p.name ?? `#${p.id}`}
                  </span>
                  {p.team_name && (
                    <span className="block truncate text-xs text-slate-500">{p.team_name}</span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600 sm:gap-6">
                  <span className="text-right">
                    <span className="block font-mono text-sm tabular-nums text-slate-900">
                      {p.budget_remaining}
                    </span>
                    <span className="text-[11px] text-slate-500">Remaining</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-sm tabular-nums text-slate-900">
                      {p.active_budget}
                    </span>
                    <span className="text-[11px] text-slate-500">Active</span>
                  </span>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => openModal(p, "give")}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
                  >
                    Give money
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal(p, "take")}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Take money
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Give / Take prompt */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cancel"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setTarget(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-sky-100 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {target.direction === "give"
                ? `How much do you want to give ${target.participant.name ?? "this participant"}?`
                : `How much do you want to take from ${target.participant.name ?? "this participant"}?`}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {target.participant.name ?? `#${target.participant.id}`} · Remaining £
              {target.participant.budget_remaining} · Active £{target.participant.active_budget}
            </p>

            <form key={`${target.participant.id}-${target.direction}`} onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input type="hidden" name="participantId" value={target.participant.id} />
              <input type="hidden" name="direction" value={target.direction} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Amount</span>
                <input
                  name="amount"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  autoFocus
                  required
                  className={selectClass}
                  placeholder="e.g. 25"
                />
              </label>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 ${
                    target.direction === "give"
                      ? "bg-sky-600 hover:bg-sky-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isPending
                    ? target.direction === "give"
                      ? "Giving…"
                      : "Taking…"
                    : target.direction === "give"
                      ? "Give money"
                      : "Take money"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
