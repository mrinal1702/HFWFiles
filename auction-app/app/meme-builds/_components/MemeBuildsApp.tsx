"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { computeStandings } from "@/lib/meme-builds/scoring";
import {
  createMemeBuild,
  loadMemeBuilds,
  saveMemeBuilds,
  touchBuild,
} from "@/lib/meme-builds/storage";
import type {
  MemeBuild,
  MemeBuildGwInfo,
  MemeBuildMatchPosMap,
  MemeBuildPoolPlayer,
  MemeBuildScoreMap,
} from "@/lib/meme-builds/types";
import { BuildEditor } from "./BuildEditor";
import { MemeGameweekView } from "./MemeGameweekView";
import { MemeStandingsTable } from "./MemeStandingsTable";

type TabId = "squad" | "standings" | `gw-${number}`;

interface MemeBuildsAppProps {
  userId: string;
  pool: MemeBuildPoolPlayer[];
  gameWeeks: MemeBuildGwInfo[];
  matchPositionsByGw: MemeBuildMatchPosMap;
}

export function MemeBuildsApp({
  userId,
  pool,
  gameWeeks,
  matchPositionsByGw,
}: MemeBuildsAppProps) {
  const [builds, setBuilds] = useState<MemeBuild[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("squad");
  const [scoreMap, setScoreMap] = useState<MemeBuildScoreMap>({});
  const [scoresLoading, setScoresLoading] = useState(false);

  const poolById = useMemo(() => new Map(pool.map((p) => [p.playerId, p])), [pool]);

  useEffect(() => {
    const loaded = loadMemeBuilds(userId);
    setBuilds(loaded);
    setActiveBuildId(loaded[0]?.id ?? null);
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    if (!hydrated) return;
    saveMemeBuilds(userId, builds);
  }, [hydrated, userId, builds]);

  const allPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of builds) {
      for (const p of b.players) ids.add(p.playerId);
    }
    return [...ids];
  }, [builds]);

  const fetchScores = useCallback(async () => {
    if (allPlayerIds.length === 0) {
      setScoreMap({});
      return;
    }
    setScoresLoading(true);
    try {
      const res = await fetch("/api/meme-builds/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: allPlayerIds,
          gameWeekIds: gameWeeks.map((gw) => gw.id),
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { scores?: MemeBuildScoreMap };
      setScoreMap(data.scores ?? {});
    } finally {
      setScoresLoading(false);
    }
  }, [allPlayerIds, gameWeeks]);

  useEffect(() => {
    if (!hydrated) return;
    void fetchScores();
  }, [hydrated, fetchScores]);

  const standings = useMemo(
    () => computeStandings(builds, gameWeeks.map((gw) => gw.id), scoreMap),
    [builds, gameWeeks, scoreMap],
  );

  const activeBuild = builds.find((b) => b.id === activeBuildId) ?? null;

  const updateBuild = (updated: MemeBuild) => {
    setBuilds((prev) =>
      prev.map((b) => (b.id === updated.id ? touchBuild(updated) : b)),
    );
  };

  const handleCreate = () => {
    const next = createMemeBuild(`Meme build ${builds.length + 1}`);
    setBuilds((prev) => [...prev, next]);
    setActiveBuildId(next.id);
    setActiveTab("squad");
  };

  const handleDelete = (buildId: string) => {
    setBuilds((prev) => {
      const next = prev.filter((b) => b.id !== buildId);
      if (activeBuildId === buildId) {
        setActiveBuildId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "squad", label: "Squad" },
    { id: "standings", label: "Standings" },
    ...gameWeeks.map((gw) => ({ id: `gw-${gw.id}` as TabId, label: gw.name })),
  ];

  if (!hydrated) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading your builds…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">Just for fun</p>
        <p className="mt-1 text-xs text-amber-900">
          Meme builds are saved in your browser only — not linked to any auction. Scores update from
          live match data when you refresh.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {builds.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setActiveBuildId(b.id);
                setActiveTab("squad");
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                b.id === activeBuildId
                  ? "border-sky-600 bg-sky-700 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {scoresLoading && (
            <span className="text-xs text-slate-500">Updating scores…</span>
          )}
          <button
            type="button"
            onClick={() => void fetchScores()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh scores
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            New build
          </button>
        </div>
      </div>

      {builds.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">No meme builds yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Create a themed squad — e.g. all players from one club — and see how they score.
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Create your first build
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                } ${tab.id === "squad" || tab.id === "standings" ? "flex-none" : "flex-1 min-w-[8rem]"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "squad" && activeBuild && (
            <BuildEditor
              build={activeBuild}
              pool={pool}
              poolById={poolById}
              onChange={updateBuild}
              onDelete={() => handleDelete(activeBuild.id)}
            />
          )}

          {activeTab === "standings" && (
            <MemeStandingsTable standings={standings} gameWeeks={gameWeeks} />
          )}

          {activeTab.startsWith("gw-") && (() => {
            const gw = gameWeeks.find((g) => activeTab === `gw-${g.id}`);
            if (!gw) return null;
            return (
              <MemeGameweekView
                builds={builds}
                poolById={poolById}
                gameWeek={gw}
                scoreMap={scoreMap}
                matchPositionsByGw={matchPositionsByGw}
                activeBuildId={activeBuildId}
              />
            );
          })()}
        </>
      )}
    </div>
  );
}
