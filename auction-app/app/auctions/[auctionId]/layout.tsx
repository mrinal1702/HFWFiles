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
    <div className="mx-auto max-w-6xl flex-1 p-6">
      <header className="mb-6 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {d.auction.name ?? `Auction #${auctionId}`}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Hard deadline:{" "}
              {d.auction.hard_deadline_at
                ? `${new Date(d.auction.hard_deadline_at).toLocaleString()} (local)`
                : "not set"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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

        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className="text-sm text-neutral-500">
            Playing as <span className="text-neutral-200">{d.me?.name ?? "—"}</span>
          </p>
          <div className="text-sm">
            <span className="text-neutral-500">budget_remaining </span>
            <span className="font-mono text-neutral-200">{d.me?.budget_remaining}</span>
            <span className="mx-2 text-neutral-600">·</span>
            <span className="text-neutral-500">active_budget </span>
            <span className="font-mono text-neutral-200">{d.me?.active_budget}</span>
          </div>
        </div>

        <AuctionNav auctionId={auctionId} />
      </header>
      {children}
    </div>
  );
}
