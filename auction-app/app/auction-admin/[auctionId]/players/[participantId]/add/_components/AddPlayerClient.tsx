"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AdminActionState } from "../../../../actions";

export type FreeAgent = {
  player_id: string;
  player_name: string | null;
  position: string | null;
  club: string | null;
};

const selectClass =
  "min-h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 sm:min-h-10 sm:px-3 sm:py-2";

export function AddPlayerClient({
  participantId,
  participantName,
  freeAgents,
  addAction,
}: {
  participantId: number;
  participantName: string;
  freeAgents: FreeAgent[];
  addAction: (prevState: AdminActionState, formData: FormData) => Promise<AdminActionState>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [club, setClub] = useState("");
  const [position, setPosition] = useState("");
  const [selected, setSelected] = useState<FreeAgent | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await addAction(null, formData);
      if (res?.ok) {
        setBanner(res.message ?? "Done.");
        setSelected(null);
        router.refresh();
      } else {
        setError(res?.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  const clubs = useMemo(() => {
    const s = new Set<string>();
    for (const p of freeAgents) {
      const c = p.club?.trim();
      if (c) s.add(c);
    }
    return [...s].sort();
  }, [freeAgents]);

  const positions = useMemo(() => {
    const s = new Set<string>();
    for (const p of freeAgents) {
      const pos = p.position?.trim();
      if (pos) s.add(pos);
    }
    return [...s].sort();
  }, [freeAgents]);

  const filtered = useMemo(() => {
    return freeAgents.filter((p) => {
      if (club && (p.club ?? "").trim() !== club) return false;
      if (position && (p.position ?? "").trim() !== position) return false;
      return true;
    });
  }, [freeAgents, club, position]);

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

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs sm:gap-1.5 sm:text-sm">
            <span className="font-medium text-slate-700">Club / nation</span>
            <select className={selectClass} value={club} onChange={(e) => setClub(e.target.value)}>
              <option value="">All</option>
              {clubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs sm:gap-1.5 sm:text-sm">
            <span className="font-medium text-slate-700">Position</span>
            <select
              className={selectClass}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="">All</option>
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Player list */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <p className="mb-3 text-xs font-medium text-slate-600">
          {filtered.length} free agent{filtered.length !== 1 ? "s" : ""}
        </p>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-600">No free agents match these filters.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p, i) => (
              <li key={p.player_id}>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSelected(p);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border border-sky-100 px-4 py-3 text-left shadow-sm hover:bg-sky-50/60 ${
                    i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {p.player_name ?? `Player #${p.player_id}`}
                    </span>
                    <span className="block truncate text-xs text-slate-600">
                      {(p.club ?? "—") + " · " + (p.position ?? "—")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-sky-700">Add →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Buy-price prompt modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cancel"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSelected(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-sky-100 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              At what buy price should {selected.player_name ?? "this player"} be added to{" "}
              {participantName}&apos;s team?
            </h3>
            <p className="mt-1 text-sm text-slate-600">Budget will not be deducted.</p>

            <form key={selected.player_id} onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input type="hidden" name="participantId" value={participantId} />
              <input type="hidden" name="playerId" value={selected.player_id} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Buy price</span>
                <input
                  name="price"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  autoFocus
                  required
                  className={selectClass}
                  placeholder="e.g. 45"
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
                  onClick={() => setSelected(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                >
                  {isPending ? "Adding…" : "Add player"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
