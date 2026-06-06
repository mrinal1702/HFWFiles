import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthUser } from "@/lib/auth/get-user";
import { getLiveAuction } from "@/lib/live-auction-data";
import type { LiveAuctionStatus } from "@/lib/live-auction-types";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<LiveAuctionStatus, string> = {
  setup: "Setting up",
  live: "🟢 Live",
  paused: "⏸ Paused",
  completed: "Completed",
};

const STATUS_COLOURS: Record<LiveAuctionStatus, string> = {
  setup: "bg-slate-100 text-slate-700",
  live: "bg-green-100 text-green-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-sky-100 text-sky-800",
};

export default async function LiveAuctionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;

  const auction = await getLiveAuction(auctionId);
  if (!auction) {
    notFound();
  }

  const user = await getAuthUser();

  return (
    <div className="mx-auto max-w-5xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <header className="mb-6 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {auction.name}
            </h1>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOURS[auction.status]}`}
            >
              {STATUS_LABELS[auction.status]}
            </span>
          </div>
          {user ? (
            <Link
              href="/live-auction"
              className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
            >
              ← All auctions
            </Link>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              Spectator view
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Budget £{auction.starting_budget} · Squad {auction.squad_size} · Min bid £{auction.min_bid}
        </p>
      </header>
      {children}
    </div>
  );
}
