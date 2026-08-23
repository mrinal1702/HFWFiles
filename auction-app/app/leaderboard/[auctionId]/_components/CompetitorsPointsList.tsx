"use client";

import { ManagerChip } from "@/app/_components/entity/ManagerChip";
import type { ParticipantOwnedPoints } from "@/lib/leaderboard-data";

interface CompetitorsPointsListProps {
  auctionId: number;
  participants: ParticipantOwnedPoints[];
}

export function CompetitorsPointsList({ auctionId, participants }: CompetitorsPointsListProps) {
  if (participants.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">No managers in this auction yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Tap a manager to see every player they own and the points each has scored so far.
      </p>

      <ul className="space-y-3 md:hidden">
        {participants.map((p, i) => (
          <li
            key={p.userId}
            className={`rounded-xl border border-sky-100 px-4 py-4 shadow-sm ${
              i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <ManagerChip
                auctionId={auctionId}
                auctionUserId={p.userId}
                name={p.name}
                teamName={p.teamName}
                avatarUrl={p.avatarUrl}
                preferTeamLabel
                labelClassName="text-base font-medium"
              />
              <span className="shrink-0 font-mono text-lg font-bold tabular-nums text-slate-900">
                {p.totalScore > 0 ? p.totalScore : "—"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {p.players.length} player{p.players.length === 1 ? "" : "s"}
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[24rem] border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
            <tr>
              <th className="px-3 py-3 font-semibold">Manager</th>
              <th className="px-3 py-3 text-right font-semibold">Players</th>
              <th className="px-3 py-3 text-right font-semibold">Points so far</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, i) => (
              <tr
                key={p.userId}
                className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-sky-50/40" : "bg-white"}`}
              >
                <td className="px-3 py-3">
                  <ManagerChip
                    auctionId={auctionId}
                    auctionUserId={p.userId}
                    name={p.name}
                    teamName={p.teamName}
                    avatarUrl={p.avatarUrl}
                    preferTeamLabel
                    labelClassName="font-medium text-slate-900"
                  />
                  {p.teamName?.trim() && (
                    <div className="mt-0.5 pl-6 text-xs text-slate-500">{p.name}</div>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-600">{p.players.length}</td>
                <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                  {p.totalScore > 0 ? p.totalScore : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
