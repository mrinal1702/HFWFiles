import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AuctionNav } from "@/app/auctions/_components/AuctionNav";
import { RefreshButton } from "@/app/auctions/_components/RefreshButton";
import { getAuthUser } from "@/lib/auth/get-user";
import { loadAuctionDashboard } from "@/lib/auction-dashboard";

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

  return (
    <div className="mx-auto max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <header className="mb-5 space-y-4 sm:mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {d.auction.name ?? `Auction #${auctionId}`}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Hard deadline:{" "}
              {d.auction.hard_deadline_at
                ? `${new Date(d.auction.hard_deadline_at).toLocaleString()} (local)`
                : "not set"}
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
            <Link href="/dashboard" className="text-sm text-neutral-400 underline hover:text-neutral-200">
              Dashboard
            </Link>
            <RefreshButton />
          </div>
        </div>

        {d.biddingClosed && (
          <div
            className="rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
            role="status"
          >
            <p className="font-medium">Bidding closed</p>
            <p className="mt-1 text-amber-200/90">{d.biddingClosedReason}</p>
          </div>
        )}

        {/* Sticky below lg so budget stays visible while scrolling long lists on phones & tablets */}
        <div
          className="max-lg:-mx-4 max-lg:border-b max-lg:border-neutral-800 max-lg:bg-[var(--background)] max-lg:px-4 max-lg:py-3 max-lg:shadow-[0_1px_0_0_rgba(255,255,255,0.06)] max-lg:sticky max-lg:top-0 max-lg:z-20"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <p className="text-sm text-neutral-500">
              Playing as <span className="text-neutral-200">{d.me?.name ?? "—"}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-4 sm:gap-y-1">
              <div className="min-w-0 rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="text-xs text-neutral-500">Remaining</div>
                <div className="font-mono text-base text-neutral-100 tabular-nums sm:text-sm">
                  {d.me?.budget_remaining ?? "—"}
                </div>
              </div>
              <div className="min-w-0 rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="text-xs text-neutral-500">Active</div>
                <div className="font-mono text-base text-neutral-100 tabular-nums sm:text-sm">
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
