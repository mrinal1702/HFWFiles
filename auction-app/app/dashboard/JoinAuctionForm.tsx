"use client";

import { useActionState } from "react";

import { joinAuctionByCodeAction, type JoinAuctionState } from "./actions";

const input =
  "min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-base uppercase tracking-wide text-slate-900 shadow-sm placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25";

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
        <span className="text-xs text-slate-600">Usually 6–8 letters or numbers (no spaces).</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-lg bg-sky-600 px-4 py-3 text-base font-medium text-white hover:bg-sky-700 disabled:opacity-50 sm:max-w-xs"
      >
        {pending ? "Joining…" : "Join auction"}
      </button>
      {state?.ok === false && (
        <p className="text-sm leading-relaxed text-red-700" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
