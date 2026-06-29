"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { releasePlayerAction } from "../actions";

interface ReleaseButtonProps {
  auctionId: number;
  playerId: string;
  playerName: string;
  purchasePrice: number;
  paidReleaseUsed: boolean;
  /** False after the hard deadline (or when auction is paused). */
  biddingOpen: boolean;
  /** Nation rolling: player locked after nation hard deadline. */
  releaseLocked?: boolean;
}

export function ReleaseButton({
  auctionId,
  playerId,
  playerName,
  purchasePrice,
  paidReleaseUsed,
  biddingOpen,
  releaseLocked = false,
}: ReleaseButtonProps) {
  if (releaseLocked) {
    return (
      <span className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
        Locked
      </span>
    );
  }

  const paidReleaseAvailable = biddingOpen && !paidReleaseUsed;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Rounds up for odd prices: 41 → 21, 40 → 20
  const refundAmount = Math.ceil(purchasePrice / 2);

  function openModal() {
    setError(null);
    setOpen(true);
  }

  function closeModal() {
    if (!isPending) setOpen(false);
  }

  function handleRelease(type: "paid" | "free") {
    setError(null);
    startTransition(async () => {
      const result = await releasePlayerAction(auctionId, playerId, type);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
      >
        Release
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">{playerName}</h3>

            {paidReleaseAvailable ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  You only get half price back on 1 release per Game Week. How do you want to
                  release this player?
                </p>
                <p className="mt-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-slate-600">
                  Paid release: £{refundAmount} returned to your budget
                  <br />
                  Free release: no refund
                </p>

                {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => handleRelease("paid")}
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
                  >
                    {isPending ? "Releasing…" : `Paid (£${refundAmount} back)`}
                  </button>
                  <button
                    onClick={() => handleRelease("free")}
                    disabled={isPending}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    {isPending ? "…" : "Free"}
                  </button>
                </div>

                <button
                  onClick={closeModal}
                  disabled={isPending}
                  className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  {!biddingOpen
                    ? "Bidding is closed — paid releases are not available. Do you want to release this player for free?"
                    : "You have used your paid release. Do you want to release this player for free?"}
                </p>

                {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => handleRelease("free")}
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
                  >
                    {isPending ? "Releasing…" : "Yes, release for free"}
                  </button>
                  <button
                    onClick={closeModal}
                    disabled={isPending}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    No, keep player
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
