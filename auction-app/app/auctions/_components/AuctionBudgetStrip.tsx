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
    <div className="max-lg:-mx-4 max-lg:border-b max-lg:border-slate-200 max-lg:bg-slate-50 max-lg:px-4 max-lg:py-3 max-lg:shadow-sm max-lg:sticky max-lg:top-0 max-lg:z-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <PlayingAsTeamName
          auctionId={auctionId}
          participantName={participantName}
          teamName={teamName}
        />
        <div className="grid grid-cols-2 gap-3 text-sm sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-4 sm:gap-y-1">
          <div className="min-w-0 rounded-lg border border-sky-100 bg-white px-2.5 py-1.5 shadow-sm sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <div className="text-[11px] font-medium text-slate-600 sm:text-xs">Remaining</div>
            <div className="font-mono text-sm tabular-nums text-slate-900 sm:text-sm">
              {budgetRemaining ?? "—"}
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-sky-100 bg-white px-2.5 py-1.5 shadow-sm sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <div className="text-[11px] font-medium text-slate-600 sm:text-xs">Active</div>
            <div className="font-mono text-sm tabular-nums text-slate-900 sm:text-sm">
              {activeBudget ?? "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
