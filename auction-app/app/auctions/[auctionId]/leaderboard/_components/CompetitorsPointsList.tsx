"use client";

import { ManagerChip } from "@/app/_components/entity/ManagerChip";

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

  const competitorHref = (userId: number) => {
    const qs = gwQuery ? `?gw=${encodeURIComponent(gwQuery)}` : "";
    return `/auctions/${auctionId}/leaderboard/competitors/${userId}${qs}`;
  };

  return (
    <div className="space-y-4">
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
                href={competitorHref(p.userId)}
              />
              <span className="shrink-0 font-mono text-lg font-bold tabular-nums text-slate-900">
                {p.seasonTotal != null ? p.seasonTotal : "—"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
            <tr>
              <th className="px-3 py-3 font-semibold">Manager</th>
              <th className="px-3 py-3 text-right font-semibold">Season total</th>
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
                    href={competitorHref(p.userId)}
                  />
                  {p.teamName?.trim() && (
                    <div className="mt-0.5 pl-6 text-xs text-slate-500">{p.name}</div>
                  )}
                </td>
                <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
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
