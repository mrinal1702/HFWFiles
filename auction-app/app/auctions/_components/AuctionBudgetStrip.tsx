"use client";

import { usePathname } from "next/navigation";

import { PlayingAsTeamName } from "@/app/auctions/_components/PlayingAsTeamName";

type Props = {
  auctionId: number;
  participantName: string;
  teamName: string | null;
  budgetRemaining: number | string | null | undefined;
  activeBudget: number | string | null | undefined;
};

/** Sticky Playing as + budgets — bidding room and My team. */
export function AuctionBudgetStrip({
  auctionId,
  participantName,
  teamName,
  budgetRemaining,
  activeBudget,
}: Props) {
  const pathname = usePathname();
  const showBudgetStrip =
    pathname === `/auctions/${auctionId}/bidding-room` ||
    pathname === `/auctions/${auctionId}/team`;
  if (!showBudgetStrip) return null;

  return (
    <div className="max-lg:-mx-4 max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:bg-slate-50/90 max-lg:px-4 max-lg:py-2 max-lg:backdrop-blur">
      <div className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 py-3 pl-5 pr-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:pl-6 sm:pr-4">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        <PlayingAsTeamName
          auctionId={auctionId}
          participantName={participantName}
          teamName={teamName}
        />
        <div className="grid grid-cols-2 gap-2 text-sm sm:flex sm:gap-3">
          <div className="min-w-0 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 px-3 py-1.5 text-white shadow-sm shadow-sky-200 sm:min-w-[6.5rem]">
            <div className="text-[11px] font-medium uppercase tracking-wide text-sky-100">Remaining</div>
            <div className="font-mono text-lg font-semibold leading-tight tabular-nums">{budgetRemaining ?? "—"}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-sky-200 bg-white px-3 py-1.5 sm:min-w-[6.5rem]">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Active</div>
            <div className="font-mono text-lg font-semibold leading-tight tabular-nums text-slate-900">
              {activeBudget ?? "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
