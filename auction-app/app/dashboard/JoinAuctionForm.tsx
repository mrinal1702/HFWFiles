"use client";

import { useActionState } from "react";

import { joinAuctionByCodeAction, type JoinAuctionState } from "./actions";

const input =
  "min-h-12 w-full rounded-xl border border-sky-200 bg-white/90 px-4 py-3 font-mono text-base uppercase tracking-wide text-slate-900 shadow-sm placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 transition focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/15";

export function JoinAuctionForm() {
  const [state, formAction, pending] = useActionState<JoinAuctionState | null, FormData>(
    joinAuctionByCodeAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">Join code</span>
        <input
          name="code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          placeholder="e.g. A1B2C3D4"
          maxLength={12}
          className={input}
          disabled={pending}
        />
        <span className="text-xs text-slate-500">Usually 6–8 letters or numbers (no spaces).</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-sky-700 px-4 py-3 text-base font-medium text-white shadow-md shadow-sky-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-200 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 sm:max-w-xs"
      >
        {pending ? "Joining…" : "Join auction"}
        {!pending && (
          <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 transition group-hover:translate-x-0.5">
            <path
              fillRule="evenodd"
              d="M3 10a.75.75 0 0 1 .75-.75h10.64l-3.72-3.72a.75.75 0 1 1 1.06-1.06l5 5a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 1 1-1.06-1.06l3.72-3.72H3.75A.75.75 0 0 1 3 10Z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
      {state?.ok === true && (
        <p className="text-sm leading-relaxed text-green-800" role="status">
          {state.message}
        </p>
      )}
      {state?.ok === false && (
        <p className="text-sm leading-relaxed text-red-700" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
