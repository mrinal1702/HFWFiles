"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateFantasyTeamNameAction } from "@/app/auctions/[auctionId]/team-name-actions";
import { fantasyTeamLabel } from "@/lib/team-name";

type Props = {
  auctionId: number;
  participantName: string;
  teamName: string | null;
};

export function PlayingAsTeamName({ auctionId, participantName, teamName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(teamName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const displayLabel = fantasyTeamLabel(teamName, participantName);

  function openModal() {
    setDraft(teamName ?? "");
    setError(null);
    setOpen(true);
  }

  function closeModal() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateFantasyTeamNameAction(auctionId, draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <p className="text-sm text-slate-600">
        Playing as{" "}
        <span className="font-medium text-slate-900">{displayLabel}</span>
        <button
          type="button"
          onClick={openModal}
          className="ml-2 text-sm font-medium text-sky-700 underline hover:text-sky-900"
        >
          Change
        </button>
      </p>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="presentation"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-labelledby="team-name-dialog-title"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="team-name-dialog-title" className="text-lg font-semibold text-slate-900">
              Enter your team name
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Shown on the leaderboard and here in the header. Leave blank to use your name (
              {participantName}).
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="fantasy-team-name" className="sr-only">
                  Team name
                </label>
                <input
                  id="fantasy-team-name"
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={48}
                  autoFocus
                  placeholder={participantName}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
                />
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={pending}
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="min-h-11 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
