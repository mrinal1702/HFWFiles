"use client";

import Link from "next/link";

import { ManagerChip } from "@/app/_components/entity/ManagerChip";
import { formatListedPosition } from "@/lib/best-xi-display";
import type { GwInfo, ParticipantOwnedPoints } from "@/lib/leaderboard-data";
import { fantasyTeamLabel } from "@/lib/team-name";

interface OwnedPointsViewProps {
  auctionId: number;
  participant: ParticipantOwnedPoints;
  gameWeeks: GwInfo[];
  /** Back link shown above the header (competitor detail pages). */
  backHref?: string;
  backLabel?: string;
  /** Hide manager summary when embedded on competitor detail. */
  compact?: boolean;
}

export function OwnedPointsView({
  auctionId,
  participant,
  gameWeeks,
  backHref,
  backLabel,
  compact = false,
}: OwnedPointsViewProps) {
  const hasAnyScores = participant.players.some((p) => p.totalScore > 0);
  const scoredGws = gameWeeks.filter((gw) =>
    participant.players.some((p) => p.scoresByGwId[String(gw.id)] != null),
  );

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
        {!compact && (
          <>
            <ManagerChip
              auctionId={auctionId}
              auctionUserId={participant.userId}
              name={participant.name}
              teamName={participant.teamName}
              avatarUrl={participant.avatarUrl}
              preferTeamLabel
              labelClassName="text-lg font-semibold text-slate-900"
            />
            {participant.teamName?.trim() && (
              <p className="mt-0.5 pl-6 text-sm text-slate-600">{participant.name}</p>
            )}
          </>
        )}
        <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${compact ? "" : "mt-3"}`}>
          <span className="text-sm text-slate-600">Total points so far:</span>
          <span className="font-mono text-2xl font-bold tabular-nums text-slate-900">
            {hasAnyScores ? participant.totalScore : "—"}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Sum of all owned players with uploaded scores. Best XI selection is not applied here.
        </p>
      </div>

      {participant.players.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No players in this squad yet.</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {participant.players.map((p, i) => (
              <div
                key={p.playerId}
                className={`rounded-xl border border-sky-100 px-4 py-4 shadow-sm ${
                  i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-900">{p.playerName ?? "—"}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {p.totalScore > 0 || Object.keys(p.scoresByGwId).length > 0 ? p.totalScore : "—"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {(p.club ?? "—") + " · " + (formatListedPosition(p.position) ?? "—")}
                </p>
                {scoredGws.length > 0 && (
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {scoredGws.map((gw) => (
                      <div key={gw.id}>
                        <span className="font-medium">{gw.name}: </span>
                        <span className="font-mono tabular-nums">
                          {p.scoresByGwId[String(gw.id)] ?? "—"}
                        </span>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
                <tr>
                  <th className="px-3 py-3 font-semibold">Player</th>
                  <th className="px-3 py-3 font-semibold">Club</th>
                  <th className="px-3 py-3 font-semibold">Pos</th>
                  {scoredGws.map((gw) => (
                    <th key={gw.id} className="px-3 py-3 text-right font-semibold">
                      {gw.name}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {participant.players.map((p, i) => (
                  <tr
                    key={p.playerId}
                    className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-sky-50/40" : "bg-white"}`}
                  >
                    <td className="px-3 py-3 font-medium text-slate-900">{p.playerName ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{p.club ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {formatListedPosition(p.position) ?? "—"}
                    </td>
                    {scoredGws.map((gw) => (
                      <td
                        key={gw.id}
                        className="px-3 py-3 text-right font-mono tabular-nums text-slate-900"
                      >
                        {p.scoresByGwId[String(gw.id)] ?? "—"}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                      {p.totalScore > 0 || Object.keys(p.scoresByGwId).length > 0 ? p.totalScore : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td
                    colSpan={3 + scoredGws.length}
                    className="px-3 py-3 text-right text-sm font-semibold text-slate-700"
                  >
                    Squad total
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-base font-bold tabular-nums text-slate-900">
                    {hasAnyScores ? participant.totalScore : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {!hasAnyScores && participant.players.length > 0 && (
        <p className="text-center text-sm text-slate-500">
          No match scores uploaded yet for{" "}
          {fantasyTeamLabel(participant.teamName, participant.name)}.
        </p>
      )}
    </div>
  );
}
