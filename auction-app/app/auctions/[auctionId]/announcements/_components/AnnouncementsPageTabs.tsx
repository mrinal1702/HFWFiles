"use client";

import { useState } from "react";

import type { Announcement, EliminationRelease } from "@/lib/announcements";

import { AnnouncementsFeed } from "./AnnouncementsFeed";
import { EliminationReleasesFeed } from "./EliminationReleasesFeed";

type PageTab = "activity" | "eliminations";

const TABS: { id: PageTab; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "eliminations", label: "Elimination Releases" },
];

export function AnnouncementsPageTabs({
  announcements,
  eliminationReleases,
  auctionId,
}: {
  announcements: Announcement[];
  eliminationReleases: EliminationRelease[];
  auctionId: number;
}) {
  const [tab, setTab] = useState<PageTab>("activity");

  return (
    <div className="space-y-4">
      <div
        className="flex gap-1 overflow-x-auto rounded-xl border border-sky-100 bg-sky-50/60 p-1"
        role="tablist"
        aria-label="Announcements sections"
      >
        {TABS.map(({ id, label }) => {
          const active = tab === id;
          const count = id === "activity" ? announcements.length : eliminationReleases.length;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={
                active
                  ? "flex-1 shrink-0 whitespace-nowrap rounded-lg bg-gradient-to-r from-sky-500 to-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-200"
                  : "flex-1 shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-sky-800"
              }
            >
              {label}
              <span className="ml-1.5 tabular-nums text-xs opacity-80">({count})</span>
            </button>
          );
        })}
      </div>

      {tab === "activity" ? (
        <div role="tabpanel">
          <AnnouncementsFeed announcements={announcements} auctionId={auctionId} />
        </div>
      ) : (
        <div role="tabpanel">
          <EliminationReleasesFeed releases={eliminationReleases} auctionId={auctionId} />
        </div>
      )}
    </div>
  );
}
