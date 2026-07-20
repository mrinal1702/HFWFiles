import Link from "next/link";
import Image from "next/image";

import { ParticipantNav } from "@/app/_components/ParticipantNav";
import { getAuthUser } from "@/lib/auth/get-user";
import {
  formatFinishLabel,
  loadAuctionHistoryForUser,
} from "@/lib/auction-history";
import { signOutAction } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function AuctionHistoryPage() {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }

  let history: Awaited<ReturnType<typeof loadAuctionHistoryForUser>> = [];
  let loadError: string | null = null;
  try {
    history = await loadAuctionHistoryForUser(user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-lg flex-1 px-4 py-8 sm:max-w-3xl sm:px-6 sm:py-10">
      <div className="mb-6 flex justify-center sm:mb-8">
        <Image
          src="/hfw-auction-logo.png"
          alt="HFW Auction logo"
          width={768}
          height={768}
          className="h-auto w-full max-w-xs sm:max-w-sm"
        />
      </div>

      <ParticipantNav active="auction-history" />

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Auction History
        </h1>
        <form action={signOutAction}>
          <button
            type="submit"
            className="min-h-10 text-sm text-slate-600 underline hover:text-slate-900"
          >
            Log out
          </button>
        </form>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Your finishes across completed auctions — newest first.
      </p>

      <section className="mt-10">
        {loadError && (
          <p className="mt-4 text-sm leading-relaxed text-red-700">
            Couldn&apos;t load auction history.{" "}
            <span className="font-mono text-xs text-red-800">{loadError}</span>
          </p>
        )}

        {!loadError && history.length === 0 && (
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            No completed auctions on your record yet. When a tournament you join finishes, your
            finish will show up here.
          </p>
        )}

        {history.length > 0 && (
          <ul className="mt-4 space-y-3">
            {history.map((row) => (
              <li key={row.auctionId}>
                <Link
                  href={`/leaderboard/${row.auctionId}`}
                  className="block min-h-[3.5rem] rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-sky-300 hover:bg-sky-50/50"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-900">{row.auctionName}</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {formatFinishLabel(row.rank)}
                    </span>
                  </div>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                    {row.year}
                    {row.totalPoints > 0 ? ` · ${row.totalPoints} pts` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-12 text-center text-sm sm:text-left">
        <Link href="/dashboard" className="text-slate-600 underline hover:text-slate-900">
          ← Back to Active Auctions
        </Link>
      </p>
    </main>
  );
}
