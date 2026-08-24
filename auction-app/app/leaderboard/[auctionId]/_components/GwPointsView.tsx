"use client";

import Link from "next/link";

import { ManagerChip } from "@/app/_components/entity/ManagerChip";
import type { GwInfo, ParticipantGwSquad } from "@/lib/leaderboard-data";

import { GwSelect } from "./GwSelect";
import { GwSquadTable } from "./GwSquadTable";

interface GwPointsViewProps {
  auctionId: number;
  squad: ParticipantGwSquad | null;
  gameWeeks: GwInfo[];
  selectedGw: GwInfo | null;
  seasonTotal: number | null;
  basePath: string;
  backHref?: string;
  backLabel?: string;
  /** Hide manager summary when the parent already shows identity. */
  compact?: boolean;
}

export function GwPointsView({
  auctionId,
  squad,
  gameWeeks,
  selectedGw,
  seasonTotal,
  basePath,
  backHref,
  backLabel,
  compact = false,
}: GwPointsViewProps) {
  const hasBestXiData = squad?.players.some((p) => p.isBestXi !== null) ?? false;
  const scoresUploaded = squad?.players.some((p) => p.score != null) ?? false;
  const rawSquadTotal = hasBestXiData
    ? null
    : (squad?.players.reduce((sum, p) => sum + (p.score ?? 0), 0) ?? 0);
  const bestXiTotal = squad?.totalGwScore ?? null;

  return (
    <div className="space-y-4">
      {backHref && (
        <Link
          href={backHref}
          className="inline-block min-h-10 py-2 text-sm font-medium text-sky-700 underline hover:text-sky-900"
        >
          {backLabel ?? "← Back"}
        </Link>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
        {!compact && squad && (
          <>
            <ManagerChip
              auctionId={auctionId}
              auctionUserId={squad.userId}
              name={squad.name}
              teamName={squad.teamName}
              avatarUrl={squad.avatarUrl}
              preferTeamLabel
              labelClassName="text-lg font-semibold text-slate-900"
            />
            {squad.teamName?.trim() && (
              <p className="mt-0.5 pl-6 text-sm text-slate-600">{squad.name}</p>
            )}
          </>
        )}

        <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${compact ? "" : "mt-3"}`}>
          <span className="text-sm text-slate-600">Season total:</span>
          <span className="font-mono text-lg font-semibold tabular-nums text-slate-900">
            {seasonTotal != null ? seasonTotal : "—"}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Full ranking is on Standings.</p>
      </div>

      <GwSelect gameWeeks={gameWeeks} selectedGwId={selectedGw?.id ?? null} basePath={basePath} />

      {gameWeeks.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">
          No gameweek squads have been locked yet.
        </p>
      )}

      {selectedGw && squad && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          {hasBestXiData && bestXiTotal != null ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm text-slate-600">Best XI score:</span>
                <span className="font-mono text-2xl font-bold tabular-nums text-slate-900">
                  {bestXiTotal}
                </span>
                {squad.formation && (
                  <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-slate-700">
                    {squad.formation}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Only Starting XI points count toward this total. Match Pos is the playing role from
                uploaded stats.
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm text-slate-600">Squad points so far:</span>
                <span className="font-mono text-2xl font-bold tabular-nums text-slate-900">
                  {scoresUploaded ? rawSquadTotal : "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Sum of this gameweek’s locked squad with uploaded scores. Best XI total replaces this
                after the gameweek is complete and formation logic runs.
              </p>
            </>
          )}
        </div>
      )}

      {selectedGw && squad && <GwSquadTable players={squad.players} formation={squad.formation} />}

      {selectedGw && !squad && (
        <p className="py-8 text-center text-sm text-slate-500">
          No locked squad for this gameweek.
        </p>
      )}
    </div>
  );
}
