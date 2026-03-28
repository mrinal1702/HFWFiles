"use client";

import { useActionState } from "react";

import { joinAuctionByCodeAction, type JoinAuctionState } from "./actions";

export function JoinAuctionForm() {
  const [state, formAction, pending] = useActionState<JoinAuctionState | null, FormData>(
    joinAuctionByCodeAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
        <span className="text-neutral-400">Join code</span>
        <input
          name="code"
          type="text"
          autoComplete="off"
          placeholder="6–8 characters"
          maxLength={12}
          className="rounded-md border border-neutral-600 bg-neutral-900 px-3 py-2 font-mono text-neutral-100 uppercase placeholder:normal-case"
          disabled={pending}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
      >
        {pending ? "Joining…" : "Join auction"}
      </button>
      {state?.ok === false && (
        <p className="w-full text-sm text-red-400" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
