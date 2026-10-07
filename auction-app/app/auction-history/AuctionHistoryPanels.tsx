"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { AuctionCard, MedalIcon } from "@/app/_components/AuctionCard";
import { TrophyCabinet } from "@/app/_components/TrophyCabinet";
import {
  formatFinishLabel,
  type AuctionHistoryEntry,
} from "@/lib/scoring/auction-history-shared";
import type { TrophyCabinetEntry } from "@/lib/scoring/trophy-cabinet-awards";

export type HistoryTabId = "past-finishes" | "trophy-cabinet";

const TABS: Array<{ id: HistoryTabId; label: string }> = [
  { id: "past-finishes", label: "Past Finishes" },
  { id: "trophy-cabinet", label: "Trophy Cabinet" },
];

/** Soft podium tints for the finish badge; other finishes stay in the sky theme. */
function finishBadgeClass(rank: number): string {
  if (rank === 1) return "border-amber-200 bg-amber-50 text-amber-800";
  if (rank === 2) return "border-slate-200 bg-slate-100 text-slate-700";
  if (rank === 3) return "border-orange-200 bg-orange-50 text-orange-800";
  return "border-sky-100 bg-white/80 text-slate-700";
}

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
                  <AuctionCard
                    href={`/leaderboard/${row.auctionId}`}
                    tone="participant"
                    title={row.auctionName}
                    icon={<MedalIcon />}
                    chips={[
                      { value: String(row.year) },
                      ...(row.totalPoints > 0 ? [{ value: `${row.totalPoints} pts` }] : []),
                    ]}
                    aside={
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${finishBadgeClass(row.rank)}`}
                      >
                        {formatFinishLabel(row.rank)}
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "trophy-cabinet" && (
        <section>
          <p className="text-sm text-slate-600">
            Trophies from championships and special cups.
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
