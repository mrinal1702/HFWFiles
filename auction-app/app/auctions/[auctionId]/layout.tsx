import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AuctionBudgetStrip } from "@/app/auctions/_components/AuctionBudgetStrip";
import { AuctionDeadlines } from "@/app/auctions/_components/AuctionDeadlines";
import { AuctionSideNav } from "@/app/auctions/_components/AuctionSideNav";
import { NationRollingDeadlinesButton } from "@/app/auctions/_components/NationRollingDeadlinesButton";
import { ParticipantLobby } from "@/app/auctions/_components/ParticipantLobby";
import { RefreshButton } from "@/app/auctions/_components/RefreshButton";
import { getAuthUser } from "@/lib/auth/get-user";
import { getAuctionAccess } from "@/lib/auction-access";
import { loadAuctionLobby } from "@/lib/auction-lobby";
import { loadAuctionDashboard } from "@/lib/auction-state/auction-dashboard";
import { loadNationDeadlinesForAuction } from "@/lib/auction-state/nation-deadlines-data";

export const dynamic = "force-dynamic";

// Public = anyone with the link, not searchable: keep auction pages out of search engines.
// (Does not affect WhatsApp / social link previews.)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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

  // May be null: public auctions are viewable by logged-out guests (view only).
  const user = await getAuthUser();
  const loginHref = `/login?next=${encodeURIComponent(`/auctions/${auctionId}`)}`;

  // Lobby (Start Bidding not pressed yet): every in-auction page shows the waiting room instead.
  // The lobby is always members-only, whatever the auction's visibility.
  const lobby = await loadAuctionLobby(auctionId);
  if (lobby) {
    if (!user) {
      redirect(loginHref);
    }
    if (!lobby.members.some((m) => m.user_id === user.id)) {
      redirect(lobby.adminUserId === user.id ? `/auction-admin/${auctionId}` : "/dashboard?error=not_member");
    }
    return <ParticipantLobby lobby={lobby} viewerUserId={user.id} />;
  }

  // One gate (lib/auction-access.ts): participants act; admin / spectators view only.
  // Participants act; admin, spectators and guests view only. Acting (bid, release, transfer)
  // is checked again server-side against the caller's own seat in THIS auction.
  const access = await getAuctionAccess(auctionId, user?.id ?? null);
  if (access.kind === "none") {
    redirect(user ? "/dashboard?error=not_member" : loginHref);
  }

  const d = await loadAuctionDashboard(auctionId, user?.id ?? null);
  if (!d.auction) {
    notFound();
  }
  const spectator = !d.me;
  const isGuest = !user;

  const nationDeadlines = d.nationRollingMode
    ? await loadNationDeadlinesForAuction(auctionId)
    : [];

  return (
    <div className="flex min-h-0 flex-1">
      <AuctionSideNav auctionId={auctionId} />
      {/* Mobile: full-width + compact scale. sm+: leave room for the thin left rail. */}
      <div className="auction-mobile-compact mx-auto min-w-0 max-w-6xl flex-1 px-3 pb-4 pt-16 sm:px-6 sm:py-6 sm:pl-[calc(3rem+1.5rem)]">
        <header className="mb-5 space-y-4 sm:mb-6">
          <div className="flex flex-col gap-3">
            <div className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-sky-900 to-sky-700 px-4 py-4 shadow-lg shadow-sky-900/20 sm:px-6 sm:py-5">
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-sky-400/25 blur-3xl"
              />
              <h1 className="relative min-w-0 text-xl font-bold tracking-tight text-white sm:text-3xl">
                {d.auction.name ?? `Auction #${auctionId}`}
              </h1>
              <div className="relative flex flex-shrink-0 flex-wrap items-center gap-3">
                {d.nationRollingMode && (
                  <NationRollingDeadlinesButton
                    deadlines={nationDeadlines}
                    finalHardDeadlineAt={d.auction.hard_deadline_at}
                  />
                )}
                <Link
                  href={isGuest ? loginHref : "/dashboard"}
                  className="inline-flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white sm:min-h-9 sm:py-1.5"
                >
                  {isGuest ? "Log in" : "Dashboard"}
                </Link>
                <RefreshButton />
              </div>
            </div>
            {d.nationRollingMode ? (
              <p className="text-sm text-slate-600">
                Rolling nation deadlines — use the{" "}
                <span className="font-medium text-slate-800">Deadlines</span> button for the full
                schedule.
              </p>
            ) : (
              <AuctionDeadlines
                initiationDeadlineAt={d.auction.initiation_deadline_at}
                raiseDeadlineAt={d.auction.raise_deadline_at}
                hardDeadlineAt={d.auction.hard_deadline_at}
              />
            )}
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

          {spectator && (
            <div
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
              role="status"
            >
              <p className="font-medium">Spectator — view only</p>
              <p className="mt-1 text-slate-600">
                You don&apos;t hold a seat in this auction. You can follow bids, budgets and squads,
                but you cannot bid, release, or transfer.
              </p>
              {isGuest && (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <Link href="/signup" className="font-medium text-sky-700 underline hover:text-sky-900">
                    Join HFW
                  </Link>
                  <Link href={loginHref} className="font-medium text-sky-700 underline hover:text-sky-900">
                    Log in
                  </Link>
                </p>
              )}
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

          {d.me && (
            <AuctionBudgetStrip
              auctionId={auctionId}
              participantName={d.me.name ?? "—"}
              teamName={d.me.team_name ?? null}
              budgetRemaining={d.me.budget_remaining}
              activeBudget={d.me.active_budget}
            />
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
