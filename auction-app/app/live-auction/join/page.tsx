"use client";

import { useActionState } from "react";
import { joinLiveAuctionAction, type JoinLiveAuctionState } from "./actions";

const input =
  "min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25";

export default function JoinLiveAuctionPage() {
  const [state, formAction, pending] = useActionState<JoinLiveAuctionState | null, FormData>(
    joinLiveAuctionAction,
    null,
  );

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Join Live Auction</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter the auction code and your name to join.
          </p>
        </div>

        <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Auction Code</span>
            <input
              name="code"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="e.g. A1B2C3D4"
              maxLength={12}
              className={`${input} font-mono uppercase tracking-wide`}
              disabled={pending}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Your Name</span>
            <input
              name="name"
              type="text"
              autoComplete="name"
              placeholder="e.g. John"
              maxLength={30}
              className={input}
              disabled={pending}
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="min-h-12 w-full rounded-lg bg-sky-600 px-4 py-3 text-base font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {pending ? "Joining…" : "Join Auction"}
          </button>

          {state?.ok === false && (
            <p className="text-sm text-red-700" role="alert">
              {state.message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
