"use client";

import { useState } from "react";
import type { GwInfo, ParticipantGwSquad, GwSquadPlayer } from "@/lib/leaderboard-data";
import {
  compareXiPlayersForDisplay,
  formatListedPosition,
  formatMatchPosition,
  formatXiRoleLabel,
  listedPositionSortKey,
} from "@/lib/best-xi-display";
import { fantasyTeamLabel } from "@/lib/team-name";

const POS_COL = "w-11 shrink-0 text-center text-[10px] font-semibold uppercase tracking-wide sm:w-12 sm:text-xs";

// ─── Column header ────────────────────────────────────────────────────────────

function SquadColumnHeader() {
  return (
    <div className="flex items-center justify-between gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:gap-2">
      <span className="min-w-0 flex-1">Player</span>
      <span className={POS_COL} title="Listed position">
        Listed Pos
      </span>
      <span className={POS_COL} title="In-match / Best XI scoring position">
        Match Pos
      </span>
      <span className="w-10 shrink-0 text-right">Pts</span>
    </div>
  );
}

/** Match Pos: Best XI formation slot when published; else FinalPoints scoring role. */
function matchPosLabelForPlayer(player: GwSquadPlayer): string | null {
  if (player.isBestXi && player.xiRole) {
    return formatXiRoleLabel(player.xiRole);
  }
  return formatMatchPosition(player.matchPosition);
}

function PositionCell({ label }: { label: string | null }) {
  return (
    <span className={`${POS_COL} text-slate-500`}>{label ?? "—"}</span>
  );
}

// ─── Player row ───────────────────────────────────────────────────────────────

function PlayerRow({ player }: { player: GwSquadPlayer }) {
  const hasScore = player.score !== null;
  const isBestXiKnown = player.isBestXi !== null;
  const inXI = player.isBestXi === true;
  const listedLabel = formatListedPosition(player.position);
  const matchLabel = matchPosLabelForPlayer(player);

  return (
    <div
      className={`flex items-center justify-between gap-1.5 px-3 py-2 text-sm sm:gap-2 ${
        isBestXiKnown && !inXI ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <span className={`font-medium ${inXI ? "text-slate-900" : "text-slate-700"}`}>
          {player.playerName ?? "—"}
        </span>
        {inXI && (
          <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
            XI
          </span>
        )}
        <span className="ml-2 text-xs text-slate-400">
          {player.club ?? "—"} · £{player.purchasePrice}
        </span>
      </div>
      <PositionCell label={listedLabel} />
      <PositionCell label={matchLabel} />
      <span
        className={`w-10 shrink-0 text-right font-mono text-sm font-semibold tabular-nums ${
          hasScore ? "text-slate-900" : "text-slate-300"
        }`}
      >
        {hasScore ? player.score : "—"}
      </span>
    </div>
  );
}

// ─── Squad display ────────────────────────────────────────────────────────────

function SquadDisplay({ players, formation }: { players: GwSquadPlayer[]; formation: string | null }) {
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
        <div className="overflow-x-auto overflow-hidden rounded-lg border border-sky-200 bg-sky-50/60">
          <div className="min-w-[20rem]">
            <div className="border-b border-sky-200 bg-sky-100 px-3 py-1.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                Starting XI ({xi.length})
              </span>
              {formation && (
                <span className="rounded bg-sky-200/80 px-2 py-0.5 text-xs font-bold tabular-nums text-sky-900">
                  {formation}
                </span>
              )}
            </div>
            <SquadColumnHeader />
            <div className="divide-y divide-sky-100">
              {xi.map((p) => (
                <PlayerRow key={p.playerId} player={p} />
              ))}
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

  // No Best XI data yet — single flat squad list
  const sorted = [...players].sort((a, b) => {
    const posOrder = (p: GwSquadPlayer) => {
      const label = formatListedPosition(p.position);
      if (label === "GK") return 0;
      if (label === "DEF") return 1;
      if (label === "MID") return 2;
      if (label === "FWD") return 3;
      return 4;
    };
    const pa = posOrder(a);
    const pb = posOrder(b);
    if (pa !== pb) return pa - pb;
    return (a.playerName ?? "").localeCompare(b.playerName ?? "");
  });

  return (
    <div className="overflow-x-auto overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="min-w-[20rem]">
        <SquadColumnHeader />
        <div className="divide-y divide-slate-100">
          {sorted.map((p) => (
            <PlayerRow key={p.playerId} player={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GameweekSquadViewProps {
  activeGw: GwInfo | null;
  squads: ParticipantGwSquad[] | null;
  /** True = locked snapshot; false = live auction_teams fallback */
  squadsAreLocked: boolean;
  myUserId: number | null;
}

export function GameweekSquadView({
  activeGw,
  squads,
  squadsAreLocked,
  myUserId,
}: GameweekSquadViewProps) {
  const defaultId =
    squads?.find((s) => s.userId === myUserId)?.userId ?? squads?.[0]?.userId ?? null;
  const [selectedUserId, setSelectedUserId] = useState<number | null>(defaultId);

  if (!squads) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-600">Squads lock at the hard deadline.</p>
        <p className="mt-1 text-xs text-slate-400">
          This panel will populate automatically once the gameweek deadline passes.
        </p>
      </div>
    );
  }

  const selected = squads.find((s) => s.userId === selectedUserId) ?? squads[0];
  const selectedTeamLabel = fantasyTeamLabel(selected.teamName, selected.name);
  const totalScore = selected.totalGwScore;
  const scoresUploaded = selected.players.some((p) => p.score !== null);
  const hasBestXiData = selected.players.some((p) => p.isBestXi !== null);
  const rawSquadTotal = hasBestXiData
    ? null
    : selected.players.reduce((sum, p) => sum + (p.score ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="flex flex-wrap items-center gap-2">
        {activeGw && (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
            {activeGw.name}
          </span>
        )}
        {!squadsAreLocked && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
            Live squad
          </span>
        )}
        {scoresUploaded && hasBestXiData && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            Match points live
          </span>
        )}
      </div>

      {/* Participant picker */}
      <div className="flex flex-wrap gap-2">
        {squads.map((s) => (
          <button
            key={s.userId}
            onClick={() => setSelectedUserId(s.userId)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              s.userId === selected.userId
                ? "border-sky-600 bg-sky-700 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {s.name}
            {s.userId === myUserId && s.userId !== selected.userId && (
              <span className="ml-1 text-xs text-slate-400">(you)</span>
            )}
          </button>
        ))}
      </div>

      {/* Score summary */}
      {totalScore !== null && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="mb-2">
            <div className="text-base font-semibold text-slate-900">{selectedTeamLabel}</div>
            {selected.teamName?.trim() && (
              <div className="text-xs text-slate-500">{selected.name}</div>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm text-slate-600">
              {activeGw ? `${activeGw.name}` : "Gameweek"} Best XI score:{" "}
            </span>
            <span className="font-mono text-lg font-bold text-slate-900">{totalScore} pts</span>
            {selected.formation && (
              <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-slate-700">
                {selected.formation}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Listed Pos is the pool role. Match Pos is the Best XI formation slot (or scoring role
            before Best XI). Only Starting XI points count toward the total.
          </p>
        </div>
      )}

      {!hasBestXiData && scoresUploaded && rawSquadTotal !== null && rawSquadTotal > 0 && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="mb-2">
            <div className="text-base font-semibold text-slate-900">{selectedTeamLabel}</div>
            {selected.teamName?.trim() && (
              <div className="text-xs text-slate-500">{selected.name}</div>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm text-slate-600">
              {activeGw ? `${activeGw.name}` : "Gameweek"} squad points so far:{" "}
            </span>
            <span className="font-mono text-lg font-bold text-slate-900">{rawSquadTotal} pts</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Sum of all locked squad players with uploaded scores. Best XI total will replace this
            after the gameweek completes and formation logic runs.
          </p>
        </div>
      )}

      {/* Squad */}
      {selected.players.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">No players in this squad yet.</p>
      ) : (
        <SquadDisplay players={selected.players} formation={selected.formation} />
      )}
    </div>
  );
}
