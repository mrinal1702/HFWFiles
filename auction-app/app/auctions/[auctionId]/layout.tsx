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
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {d.auction.name ?? `Auction #${auctionId}`}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Hard deadline:{" "}
              {d.auction.hard_deadline_at
                ? `${new Date(d.auction.hard_deadline_at).toLocaleString()} (local)`
                : "not set"}
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
            <Link href="/dashboard" className="text-sm font-medium text-sky-700 underline hover:text-sky-900">
              Dashboard
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

        <div className="max-lg:-mx-4 max-lg:border-b max-lg:border-slate-200 max-lg:bg-slate-50 max-lg:px-4 max-lg:py-3 max-lg:shadow-sm max-lg:sticky max-lg:top-0 max-lg:z-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <p className="text-sm text-slate-600">
              Playing as <span className="font-medium text-slate-900">{d.me?.name ?? "—"}</span>
            </p>
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
