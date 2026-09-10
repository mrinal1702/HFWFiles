"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { TrophyCabinet, type TrophyCabinetEntry } from "@/app/_components/TrophyCabinet";
import {
  formatFinishLabel,
  type AuctionHistoryEntry,
} from "@/lib/auction-history-shared";

export type HistoryTabId = "past-finishes" | "trophy-cabinet";

const TABS: Array<{ id: HistoryTabId; label: string }> = [
  { id: "past-finishes", label: "Past Finishes" },
  { id: "trophy-cabinet", label: "Trophy Cabinet" },
];

function parseTab(value: string | null | undefined): HistoryTabId {
  if (value === "trophy-cabinet") return "trophy-cabinet";
  return "past-finishes";
}

type AuctionHistoryPanelsProps = {
  history: AuctionHistoryEntry[];
  trophies: TrophyCabinetEntry[];
  loadError: string | null;
  initialTab: HistoryTabId;
};

export function AuctionHistoryPanels({
  history,
  trophies,
  loadError,
  initialTab,
}: AuctionHistoryPanelsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab") ?? initialTab);

  const setTab = useCallback(
    (tab: HistoryTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "past-finishes") params.delete("tab");
      else params.set("tab", tab);
      const qs = params.toString();
      router.replace(qs ? `/auction-history?${qs}` : "/auction-history", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="mt-8 space-y-5">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1">
        {TABS.map(({ id, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === "past-finishes" && (
        <section>
          <p className="text-sm text-slate-600">
            Your finishes across completed auctions — newest first.
          </p>

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
      )}

      {activeTab === "trophy-cabinet" && (
        <section>
          <p className="text-sm text-slate-600">
            Championship trophies from auctions you finished first in.
          </p>
          {loadError ? (
            <p className="mt-4 text-sm leading-relaxed text-red-700">
              Couldn&apos;t load trophy cabinet.{" "}
              <span className="font-mono text-xs text-red-800">{loadError}</span>
            </p>
          ) : (
            <TrophyCabinet
              trophies={trophies}
              emptyMessage="Your trophy cabinet is empty."
            />
          )}
        </section>
      )}
    </div>
  );
}
