"use client";

import Link from "next/link";

import { Avatar } from "@/app/_components/entity/Avatar";
import { fantasyTeamLabel } from "@/lib/team-name";
import type { GwInfo, ParticipantGwSquad } from "@/lib/scoring/leaderboard-data";

import { GwSelect } from "./GwSelect";
import { GwSquadTable } from "./GwSquadTable";

interface GwPointsViewProps {
  /** Kept for callers; the header identity is not a link (this page IS the manager's points). */
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
          className="inline-flex min-h-10 items-center py-2 text-sm font-medium text-sky-700 hover:text-sky-900"
        >
          {backLabel ?? "← Back"}
        </Link>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 py-4 pl-5 pr-4 shadow-sm sm:pl-6 sm:pr-5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!compact && squad ? (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={squad.name} avatarUrl={squad.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-900">
                  {fantasyTeamLabel(squad.teamName, squad.name)}
                </p>
                {squad.teamName?.trim() && <p className="text-sm text-slate-600">{squad.name}</p>}
              </div>
            </div>
          ) : (
            <span />
          )}
          <div className="rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 px-3 py-1.5 text-white shadow-sm shadow-sky-200 sm:min-w-[8rem]">
            <div className="text-[11px] font-medium uppercase tracking-wide text-sky-100">Season total</div>
            <div className="font-mono text-lg font-semibold leading-tight tabular-nums">
              {seasonTotal != null ? seasonTotal : "—"}
            </div>
          </div>
        </div>
      </div>

      <GwSelect gameWeeks={gameWeeks} selectedGwId={selectedGw?.id ?? null} basePath={basePath} />

      {gameWeeks.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">
          No gameweek squads have been locked yet.
        </p>
      )}

      {selectedGw && squad && (
        <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 shadow-sm">
          {hasBestXiData && bestXiTotal != null ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm text-slate-600">Best XI score:</span>
                <span className="font-mono text-2xl font-bold tabular-nums text-slate-900">
                  {bestXiTotal}
                </span>
                {squad.formation && (
                  <span className="rounded-lg bg-sky-100 px-2 py-0.5 text-xs font-bold tabular-nums text-sky-900 ring-1 ring-sky-200">
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
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm text-slate-600">Squad points so far:</span>
              <span className="font-mono text-2xl font-bold tabular-nums text-slate-900">
                {scoresUploaded ? rawSquadTotal : "—"}
              </span>
            </div>
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
