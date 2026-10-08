"use client";

import { PointsManagerChip } from "./PointsManagerChip";

export type CompetitorListEntry = {
  userId: number;
  name: string;
  teamName: string | null;
  avatarUrl: string | null;
  seasonTotal: number | null;
};

interface CompetitorsPointsListProps {
  auctionId: number;
  participants: CompetitorListEntry[];
  gwQuery?: string | null;
}

export function CompetitorsPointsList({
  auctionId,
  participants,
  gwQuery,
}: CompetitorsPointsListProps) {
  if (participants.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">No managers in this auction yet.</p>
    );
  }

  const chip = (p: CompetitorListEntry, labelClassName: string) => (
    <PointsManagerChip
      auctionId={auctionId}
      userId={p.userId}
      name={p.name}
      teamName={p.teamName}
      avatarUrl={p.avatarUrl}
      labelClassName={labelClassName}
      from="competitors"
      gw={gwQuery}
    />
  );

  return (
    <div className="space-y-4">
      <ul className="space-y-2.5 md:hidden">
        {participants.map((p) => (
          <li
            key={p.userId}
            className="relative overflow-hidden rounded-xl border border-sky-200 bg-white py-3.5 pl-5 pr-4 shadow-sm"
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                {chip(p, "text-base font-medium")}
                {p.teamName?.trim() && <p className="mt-0.5 pl-6 text-xs text-slate-500">{p.name}</p>}
              </div>
              <span className="shrink-0 font-mono text-lg font-bold tabular-nums text-slate-900">
                {p.seasonTotal != null ? p.seasonTotal : "—"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[20rem] border-separate border-spacing-y-2 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Manager</th>
              <th className="w-32 px-3 py-2 text-right font-semibold">Season total</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr
                key={p.userId}
                className="[&>td]:border-y [&>td]:border-sky-200 [&>td]:bg-white [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l-[6px] [&>td:first-child]:border-l-sky-400 [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r hover:[&>td]:bg-sky-50"
              >
                <td className="px-3 py-3">
                  {chip(p, "font-medium text-slate-900")}
                  {p.teamName?.trim() && (
                    <div className="mt-0.5 pl-6 text-xs text-slate-500">{p.name}</div>
                  )}
                </td>
                <td className="px-3 py-3 text-right font-mono text-base font-semibold tabular-nums text-slate-900">
                  {p.seasonTotal != null ? p.seasonTotal : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
