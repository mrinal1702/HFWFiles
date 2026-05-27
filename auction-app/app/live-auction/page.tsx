import Link from "next/link";

import { getLiveAuctions } from "@/lib/live-auction-data";
import type { LiveAuctionStatus } from "@/lib/live-auction-types";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<LiveAuctionStatus, string> = {
  setup: "Setting up",
  live: "Live",
  paused: "Paused",
  completed: "Completed",
};

const STATUS_COLOURS: Record<LiveAuctionStatus, string> = {
  setup: "bg-slate-100 text-slate-700",
  live: "bg-green-100 text-green-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-sky-100 text-sky-800",
};

export default async function LiveAuctionListPage() {
  let auctions: Awaited<ReturnType<typeof getLiveAuctions>> = [];
  let loadError: string | null = null;
  try {
    auctions = await getLiveAuctions();
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
    auctions = [];
  }

  return (
    <main className="mx-auto max-w-lg flex-1 px-4 py-8 sm:max-w-3xl sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Live Auctions
        </h1>
        <Link href="/dashboard" className="text-sm font-medium text-sky-700 underline hover:text-sky-900">
          ← Dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Live auction events — bidding happens verbally on Zoom or in person. Use the app to track sales
        and view squads in real time.
      </p>

      {loadError && (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load auctions: {loadError}
        </p>
      )}

      {!loadError && auctions.length === 0 && (
        <div className="mt-10 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-600">No live auctions yet.</p>
          <p className="mt-1 text-xs text-slate-500">
            Auctions are created directly in Supabase for now.
          </p>
        </div>
      )}

      {auctions.length > 0 && (
        <ul className="mt-8 space-y-3">
          {auctions.map((a) => (
            <li key={a.id}>
              <Link
                href={`/live-auction/${a.id}`}
                className="block rounded-xl border border-sky-100 bg-white px-5 py-4 shadow-sm hover:border-sky-300 hover:bg-sky-50/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{a.name}</span>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOURS[a.status]}`}
                  >
                    {STATUS_LABELS[a.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Budget £{a.starting_budget} · Squad {a.squad_size} · Min bid £{a.min_bid}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
