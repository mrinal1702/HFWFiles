"use client";

import { useMemo, useState } from "react";
import {
  compareXiPlayersForDisplay,
  formatListedPosition,
  formatMatchPosition,
  listedPositionSortKey,
  type XiRole,
} from "@/lib/best-xi-display";
import { computeBuildGwTotal } from "@/lib/meme-builds/scoring";
import type {
  MemeBuild,
  MemeBuildGwInfo,
  MemeBuildMatchPosMap,
  MemeBuildPoolPlayer,
  MemeBuildScoreMap,
} from "@/lib/meme-builds/types";

type DisplayPlayer = {
  playerId: string;
  playerName: string | null;
  position: string | null;
  matchPosition: string | null;
  country: string | null;
  score: number;
  inXi: boolean;
  xiRole: XiRole | null;
};

const POS_COL =
  "w-11 shrink-0 text-center text-[10px] font-semibold uppercase tracking-wide sm:w-12 sm:text-xs";

function SquadColumnHeader() {
  return (
    <div className="flex items-center justify-between gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:gap-2">
      <span className="min-w-0 flex-1">Player</span>
      <span className={POS_COL}>Listed</span>
      <span className={POS_COL}>Match</span>
      <span className="w-10 shrink-0 text-right">Pts</span>
    </div>
  );
}

function PlayerRow({ player }: { player: DisplayPlayer }) {
  return (
    <div
      className={`flex items-center justify-between gap-1.5 px-3 py-2 text-sm sm:gap-2 ${
        !player.inXi ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <span className={`font-medium ${player.inXi ? "text-slate-900" : "text-slate-700"}`}>
          {player.playerName ?? "—"}
        </span>
        {player.inXi && (
          <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
            XI
          </span>
        )}
        <span className="ml-2 text-xs text-slate-400">{player.country ?? "—"}</span>
      </div>
      <span className={`${POS_COL} text-slate-500`}>
        {formatListedPosition(player.position) ?? "—"}
      </span>
      <span className={`${POS_COL} text-slate-500`}>
        {formatMatchPosition(player.matchPosition) ?? "—"}
      </span>
      <span className="w-10 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-slate-900">
        {player.score}
      </span>
    </div>
  );
}

function SquadDisplay({ players }: { players: DisplayPlayer[] }) {
  const xi = players.filter((p) => p.inXi).sort(compareXiPlayersForDisplay);
  const bench = players
    .filter((p) => !p.inXi)
    .sort((a, b) => {
      const pa = listedPositionSortKey(a.position);
      const pb = listedPositionSortKey(b.position);
      if (pa !== pb) return pa - pb;
      return b.score - a.score;
    });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto overflow-hidden rounded-lg border border-sky-200 bg-sky-50/60">
        <div className="min-w-[20rem]">
          <div className="border-b border-sky-200 bg-sky-100 px-3 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-800">
              Starting XI ({xi.length})
            </span>
          </div>
          <SquadColumnHeader />
          <div className="divide-y divide-sky-100">
            {xi.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500">
                No starters selected — toggle XI on players in the Squad tab.
              </p>
            ) : (
              xi.map((p) => <PlayerRow key={p.playerId} player={p} />)
            )}
          </div>
        </div>
      </div>

      {bench.length > 0 && (
        <div className="overflow-x-auto overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="min-w-[20rem]">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bench ({bench.length})
              </span>
            </div>
            <SquadColumnHeader />
            <div className="divide-y divide-slate-100">
              {bench.map((p) => (
                <PlayerRow key={p.playerId} player={p} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MemeGameweekViewProps {
  builds: MemeBuild[];
  poolById: Map<string, MemeBuildPoolPlayer>;
  gameWeek: MemeBuildGwInfo;
  scoreMap: MemeBuildScoreMap;
  matchPositionsByGw: MemeBuildMatchPosMap;
  activeBuildId: string | null;
}

export function MemeGameweekView({
  builds,
  poolById,
  gameWeek,
  scoreMap,
  matchPositionsByGw,
  activeBuildId,
}: MemeGameweekViewProps) {
  const defaultId = activeBuildId ?? builds[0]?.id ?? null;
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(defaultId);

  const selected = builds.find((b) => b.id === selectedBuildId) ?? builds[0];

  const displayPlayers = useMemo((): DisplayPlayer[] => {
    if (!selected) return [];
    const gwKey = String(gameWeek.id);
    const matchPos = matchPositionsByGw[gwKey] ?? {};
    const gwScores = scoreMap[gwKey] ?? {};

    return selected.players.map((sp) => {
      const meta = poolById.get(sp.playerId);
      return {
        playerId: sp.playerId,
        playerName: meta?.playerName ?? null,
        position: meta?.position ?? null,
        matchPosition: matchPos[sp.playerId] ?? null,
        country: meta?.country ?? null,
        score: gwScores[sp.playerId] ?? 0,
        inXi: sp.inXi,
        xiRole: null,
      };
    });
  }, [selected, poolById, gameWeek.id, scoreMap, matchPositionsByGw]);

  if (builds.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Create a meme build to see gameweek scores.
      </p>
    );
  }

  if (!selected) return null;

  const totalScore = computeBuildGwTotal(selected, gameWeek.id, scoreMap);
  const xiCount = selected.players.filter((p) => p.inXi).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
          {gameWeek.name}
        </span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
          Starting XI scores only
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {builds.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelectedBuildId(b.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              b.id === selected.id
                ? "border-sky-600 bg-sky-700 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
        <div className="text-base font-semibold text-slate-900">{selected.name}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm text-slate-600">{gameWeek.name} XI score:</span>
          <span className="font-mono text-lg font-bold text-slate-900">{totalScore} pts</span>
          <span className="text-xs text-slate-500">({xiCount} starters)</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Missing scores count as 0. Only players marked as Starting XI contribute.
        </p>
      </div>

      {displayPlayers.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">No players in this build yet.</p>
      ) : (
        <SquadDisplay players={displayPlayers} />
      )}
    </div>
  );
}
