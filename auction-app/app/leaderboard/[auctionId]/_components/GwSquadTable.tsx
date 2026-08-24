"use client";

import type { GwSquadPlayer } from "@/lib/leaderboard-data";
import {
  compareXiPlayersForDisplay,
  formatListedPosition,
  formatMatchPosition,
  listedPositionSortKey,
} from "@/lib/best-xi-display";

function scoreLabel(player: GwSquadPlayer): string {
  return player.score != null ? String(player.score) : "—";
}

function sortFlatSquad(players: GwSquadPlayer[]): GwSquadPlayer[] {
  return [...players].sort((a, b) => {
    const pa = listedPositionSortKey(a.position);
    const pb = listedPositionSortKey(b.position);
    if (pa !== pb) return pa - pb;
    return (a.playerName ?? "").localeCompare(b.playerName ?? "");
  });
}

function PlayerCard({ player, index, dimmed }: { player: GwSquadPlayer; index: number; dimmed: boolean }) {
  return (
    <div
      className={`rounded-xl border border-sky-100 px-4 py-4 shadow-sm ${
        index % 2 === 0 ? "bg-white" : "bg-sky-50/80"
      } ${dimmed ? "opacity-50" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-slate-900">{player.playerName ?? "—"}</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">{scoreLabel(player)}</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{player.club ?? "—"}</p>
      <p className="mt-1 text-xs text-slate-500">
        Listed Pos {formatListedPosition(player.position) ?? "—"} · Match Pos{" "}
        {formatMatchPosition(player.matchPosition) ?? "—"}
      </p>
    </div>
  );
}

function SquadTable({ players, dimBench }: { players: GwSquadPlayer[]; dimBench: boolean }) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {players.map((p, i) => (
          <PlayerCard
            key={p.playerId}
            player={p}
            index={i}
            dimmed={dimBench && p.isBestXi === false}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
            <tr>
              <th className="px-3 py-3 font-semibold">Player</th>
              <th className="px-3 py-3 font-semibold">Club</th>
              <th className="px-3 py-3 font-semibold">Listed Pos</th>
              <th className="px-3 py-3 font-semibold">Match Pos</th>
              <th className="px-3 py-3 text-right font-semibold">Score</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => {
              const dimmed = dimBench && p.isBestXi === false;
              return (
                <tr
                  key={p.playerId}
                  className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-sky-50/40" : "bg-white"} ${
                    dimmed ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-3 py-3 font-medium text-slate-900">{p.playerName ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-600">{p.club ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-600">{formatListedPosition(p.position) ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {formatMatchPosition(p.matchPosition) ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {scoreLabel(p)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function GwSquadTable({
  players,
  formation,
}: {
  players: GwSquadPlayer[];
  formation: string | null;
}) {
  if (players.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No players in this squad yet.</p>;
  }

  const hasBestXiData = players.some((p) => p.isBestXi !== null);

  if (hasBestXiData) {
    const xi = players.filter((p) => p.isBestXi === true).sort(compareXiPlayersForDisplay);
    const bench = players
      .filter((p) => p.isBestXi === false)
      .sort((a, b) => {
        const pa = listedPositionSortKey(a.position);
        const pb = listedPositionSortKey(b.position);
        if (pa !== pb) return pa - pb;
        return (b.score ?? -1) - (a.score ?? -1);
      });

    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-sky-50/60">
          <div className="flex items-center justify-between gap-2 border-b border-sky-200 bg-sky-100 px-3 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-800">
              Starting XI ({xi.length})
            </span>
            {formation && (
              <span className="rounded bg-sky-200/80 px-2 py-0.5 text-xs font-bold tabular-nums text-sky-900">
                {formation}
              </span>
            )}
          </div>
          <div className="p-3 md:p-0">
            <SquadTable players={xi} dimBench={false} />
          </div>
        </div>

        {bench.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bench ({bench.length})
              </span>
            </div>
            <div className="p-3 md:p-0">
              <SquadTable players={bench} dimBench />
            </div>
          </div>
        )}
      </div>
    );
  }

  return <SquadTable players={sortFlatSquad(players)} dimBench={false} />;
}
