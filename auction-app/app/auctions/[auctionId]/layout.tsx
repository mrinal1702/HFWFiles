import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PlayingAsTeamName } from "@/app/auctions/_components/PlayingAsTeamName";
import { AuctionDeadlines } from "@/app/auctions/_components/AuctionDeadlines";
import { NationRollingDeadlinesButton } from "@/app/auctions/_components/NationRollingDeadlinesButton";
import { AuctionNav } from "@/app/auctions/_components/AuctionNav";
import { RefreshButton } from "@/app/auctions/_components/RefreshButton";
import { getAuthUser } from "@/lib/auth/get-user";
import { loadAuctionDashboard } from "@/lib/auction-dashboard";
import { loadNationDeadlinesForAuction } from "@/lib/nation-deadlines-data";

export const dynamic = "force-dynamic";

export default async function AuctionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  if (!Number.isFinite(auctionId) || auctionId <= 0) {
    notFound();
  }

  const user = await getAuthUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/auctions/${auctionId}`)}`);
  }

  const d = await loadAuctionDashboard(auctionId, user.id);
  if (!d.auction) {
    notFound();
  }
  if (!d.me) {
    redirect("/dashboard?error=not_member");
  }

  const nationDeadlines = d.nationRollingMode
    ? await loadNationDeadlinesForAuction(auctionId)
    : [];

  return (
    <div className="mx-auto max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <header className="mb-5 space-y-4 sm:mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {d.auction.name ?? `Auction #${auctionId}`}
            </h1>
            <div className="mt-2">
              {d.nationRollingMode ? (
                <p className="text-sm text-slate-600">
                  Rolling nation deadlines — use the{" "}
                  <span className="font-medium text-slate-800">Deadlines</span> button for the full schedule.
                </p>
              ) : (
                <AuctionDeadlines
                  initiationDeadlineAt={d.auction.initiation_deadline_at}
                  raiseDeadlineAt={d.auction.raise_deadline_at}
                  hardDeadlineAt={d.auction.hard_deadline_at}
                />
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
            {d.nationRollingMode && (
              <NationRollingDeadlinesButton
                deadlines={nationDeadlines}
                finalHardDeadlineAt={d.auction.hard_deadline_at}
              />
            )}
            <Link href="/dashboard" className="text-sm font-medium text-sky-700 underline hover:text-sky-900">
              Dashboard
            </Link>
            <Link
              href={`/auctions/${auctionId}/announcements`}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700 active:bg-slate-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892L5.18 10.028a.5.5 0 0 0 .645.645l2.362-.974a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.475ZM1.75 9.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5ZM1 12.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75ZM1.75 7a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5Z" />
              </svg>
              Announcements
            </Link>
            <RefreshButton />
          </div>
        </div>

        {d.biddingClosed && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            <p className="font-medium">Bidding closed</p>
            <p className="mt-1 text-amber-900">{d.biddingClosedReason}</p>
          </div>
        )}

        {d.me?.is_relegated && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
            role="status"
          >
            <p className="font-medium">Relegated — view only</p>
            <p className="mt-1 text-red-900">
              You were relegated after the group stage / Round of 32 cut. You can still view
              leaderboards and bidding activity, but you cannot bid, release players, transfer, or
              own a squad.
            </p>
          </div>
        )}

        <div className="max-lg:-mx-4 max-lg:border-b max-lg:border-slate-200 max-lg:bg-slate-50 max-lg:px-4 max-lg:py-3 max-lg:shadow-sm max-lg:sticky max-lg:top-0 max-lg:z-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <PlayingAsTeamName
              auctionId={auctionId}
              participantName={d.me?.name ?? "—"}
              teamName={d.me?.team_name ?? null}
            />
            <div className="grid grid-cols-2 gap-3 text-sm sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-4 sm:gap-y-1">
              <div className="min-w-0 rounded-lg border border-sky-100 bg-white px-3 py-2 shadow-sm sm:border-0 sm:bg-transparent sm:shadow-none sm:p-0">
                <div className="text-xs font-medium text-slate-600">Remaining</div>
                <div className="font-mono text-base tabular-nums text-slate-900 sm:text-sm">
                  {d.me?.budget_remaining ?? "—"}
                </div>
              </div>
              <div className="min-w-0 rounded-lg border border-sky-100 bg-white px-3 py-2 shadow-sm sm:border-0 sm:bg-transparent sm:shadow-none sm:p-0">
                <div className="text-xs font-medium text-slate-600">Active</div>
                <div className="font-mono text-base tabular-nums text-slate-900 sm:text-sm">
                  {d.me?.active_budget ?? "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <AuctionNav auctionId={auctionId} />
      </header>
      {children}
    </div>
  );
}
