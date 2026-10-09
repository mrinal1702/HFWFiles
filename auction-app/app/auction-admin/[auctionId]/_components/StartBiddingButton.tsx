"use client";

import { useActionState, useState } from "react";

import { startBiddingAction, type StartBiddingState } from "../lobby-actions";

/** The one irreversible lobby → bidding button, with the confirmation dialog. */
export function StartBiddingButton({
  auctionId,
  roundId,
  roundName,
}: {
  auctionId: number;
  roundId: number;
  roundName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<StartBiddingState, FormData>(
    startBiddingAction.bind(null, auctionId, roundId),
    null,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-sky-700 px-4 py-3 text-base font-semibold text-white shadow-md shadow-sky-200 transition hover:-translate-y-0.5 hover:shadow-lg sm:w-auto sm:px-6"
      >
        Start Bidding
      </button>
      {state?.ok === false && !open && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {state.message}
        </p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <form
            action={formAction}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-bidding-title"
          >
            <h3 id="start-bidding-title" className="font-display text-lg font-semibold text-slate-900">
              Start bidding?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Are you sure? New participants can still join, but they might miss out on some player deadlines if
              it&apos;s too late.
            </p>
            <p className="mt-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-slate-700">
              Your first gameweek will be <strong className="text-slate-900">{roundName}</strong>. This can&apos;t be
              undone.
            </p>
            {state?.ok === false && (
              <p className="mt-3 text-sm font-medium text-red-700" role="alert">
                {state.message}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
              >
                {pending ? "Starting…" : "Yes, start bidding"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
