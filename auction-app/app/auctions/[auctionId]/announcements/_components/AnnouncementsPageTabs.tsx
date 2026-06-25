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
}: {
  announcements: Announcement[];
  eliminationReleases: EliminationRelease[];
}) {
  const [tab, setTab] = useState<PageTab>("activity");

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-2 border-b border-slate-200 pb-3"
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
                  ? "rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm"
                  : "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
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
          <AnnouncementsFeed announcements={announcements} />
        </div>
      ) : (
        <div role="tabpanel">
          <EliminationReleasesFeed releases={eliminationReleases} />
        </div>
      )}
    </div>
  );
}
