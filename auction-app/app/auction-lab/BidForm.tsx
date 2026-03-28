"use client";

import { useActionState } from "react";

import { submitBidAction, type BidFormState } from "./actions";

export type LabUserOption = {
  id: number;
  name: string | null;
  budget_remaining: number;
  active_budget: number;
};

export type LabLotOption = {
  player_id: string;
  player_name: string | null;
  status: string;
};

type Props = {
  users: LabUserOption[];
  lots: LabLotOption[];
};

export function BidForm({ users, lots }: Props) {
  const [state, formAction, pending] = useActionState<BidFormState | null, FormData>(
    submitBidAction,
    null,
  );

  const biddableLots = lots.filter((l) => l.status === "uninitiated" || l.status === "bidding");

  return (
    <section className="rounded-lg border border-neutral-700 bg-neutral-950/40 p-4">
      <h2 className="mb-3 text-lg font-semibold">Place a bid (test)</h2>
      <p className="mb-4 text-sm text-neutral-400">
        Choose which fantasy manager you are pretending to be, pick a player lot, enter a whole-number
        bid, then submit. The server calls <code className="text-neutral-300">place_bid</code> with the
        service role.
      </p>

      {state && (
        <div
          className={`mb-4 rounded-md px-3 py-2 text-sm ${
            state.ok ? "bg-emerald-950/60 text-emerald-200" : "bg-red-950/50 text-red-200"
          }`}
          role="status"
        >
          {state.message}
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-neutral-400">Bidder</span>
          <select
            name="auction_user_id"
            required
            className="rounded border border-neutral-600 bg-neutral-900 px-2 py-2 text-neutral-100"
            defaultValue=""
          >
            <option value="" disabled>
              Select user…
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? `User #${u.id}`} (#{u.id})
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
          <span className="text-neutral-400">Player lot</span>
          <select
            name="player_id"
            required
            className="rounded border border-neutral-600 bg-neutral-900 px-2 py-2 text-neutral-100"
            defaultValue=""
          >
            <option value="" disabled>
              {biddableLots.length ? "Select player…" : "No open lots"}
            </option>
            {biddableLots.map((l) => (
              <option key={l.player_id} value={l.player_id}>
                {l.player_name ?? l.player_id} — {l.status}
              </option>
            ))}
          </select>
        </label>

        <label className="flex w-28 flex-col gap-1 text-sm">
          <span className="text-neutral-400">Amount</span>
          <input
            name="amount"
            type="number"
            min={5}
            step={1}
            required
            placeholder="5+"
            className="rounded border border-neutral-600 bg-neutral-900 px-2 py-2 text-neutral-100"
          />
        </label>

        <button
          type="submit"
          disabled={pending || !users.length || !biddableLots.length}
          className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40"
        >
          {pending ? "Submitting…" : "Submit bid"}
        </button>
      </form>
    </section>
  );
}
