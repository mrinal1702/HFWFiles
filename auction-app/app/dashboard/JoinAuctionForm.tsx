"use client";

import { useActionState } from "react";

import { joinAuctionByCodeAction, type JoinAuctionState } from "./actions";

export function JoinAuctionForm() {
  const [state, formAction, pending] = useActionState<JoinAuctionState | null, FormData>(
    joinAuctionByCodeAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm text-neutral-400">Join code</span>
        <input
          name="code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          placeholder="e.g. A1B2C3D4"
          maxLength={12}
          className="min-h-12 w-full rounded-lg border border-neutral-600 bg-neutral-900 px-4 py-3 font-mono text-base uppercase tracking-wide text-neutral-100 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-600"
          disabled={pending}
        />
        <span className="text-xs text-neutral-600">Usually 6–8 letters or numbers (no spaces).</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-lg bg-neutral-100 px-4 py-3 text-base font-medium text-neutral-900 disabled:opacity-50 sm:max-w-xs"
      >
        {pending ? "Joining…" : "Join auction"}
      </button>
      {state?.ok === false && (
        <p className="text-sm leading-relaxed text-red-400" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
