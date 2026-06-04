import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RefreshButton } from "@/app/auctions/_components/RefreshButton";
import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function LeaderboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  if (!Number.isFinite(auctionId) || auctionId <= 0) notFound();

  const user = await getAuthUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/leaderboard/${auctionId}`)}`);
  }

  const admin = createAdminClient();
  const { data: auction } = await admin
    .from("Auctions")
    .select("id, name")
    .eq("id", auctionId)
    .maybeSingle();
  if (!auction) notFound();

  return (
    <div className="mx-auto max-w-5xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            <Link
              href={`/auctions/${auctionId}/bidding-room`}
              className="font-medium text-sky-700 hover:underline"
            >
              ← Back to auction
            </Link>
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {auction.name ?? `Auction #${auctionId}`}
            <span className="ml-2 font-normal text-slate-400">· Leaderboard</span>
          </h1>
        </div>
        <RefreshButton />
      </header>
      {children}
    </div>
  );
}
