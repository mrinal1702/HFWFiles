import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";

import { ParticipantNav } from "@/app/_components/ParticipantNav";
import { getAuthUser } from "@/lib/auth/get-user";
import {
  loadAuctionHistoryForUser,
  trophiesFromHistory,
} from "@/lib/auction-history";
import { signOutAction } from "@/app/auth/actions";

import {
  AuctionHistoryPanels,
  type HistoryTabId,
} from "./AuctionHistoryPanels";

export const dynamic = "force-dynamic";

function parseTab(value: string | undefined): HistoryTabId {
  if (value === "trophy-cabinet") return "trophy-cabinet";
  return "past-finishes";
}

export default async function AuctionHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }

  const sp = searchParams ? await searchParams : undefined;
  const initialTab = parseTab(sp?.tab);

  let history: Awaited<ReturnType<typeof loadAuctionHistoryForUser>> = [];
  let loadError: string | null = null;
  try {
    history = await loadAuctionHistoryForUser(user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  const trophies = trophiesFromHistory(history);

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

      <Suspense
        fallback={
          <p className="mt-8 text-sm text-slate-600">Loading history…</p>
        }
      >
        <AuctionHistoryPanels
          history={history}
          trophies={trophies}
          loadError={loadError}
          initialTab={initialTab}
        />
      </Suspense>

      <p className="mt-12 text-center text-sm sm:text-left">
        <Link href="/dashboard" className="text-slate-600 underline hover:text-slate-900">
          ← Back to Active Auctions
        </Link>
      </p>
    </main>
  );
}
