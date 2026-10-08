import { ManagerChip } from "@/app/_components/entity/ManagerChip";
import type { CompetitorSummaryRow } from "@/lib/auction-state/auction-dashboard";

type Props = {
  auctionId: number;
  rows: CompetitorSummaryRow[];
};

export function CompetitorsAuctionList({ auctionId, rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">No managers in this auction yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2.5 md:hidden">
        {rows.map((row) => (
          <li
            key={row.user.id}
            className="relative overflow-hidden rounded-xl border border-sky-200 bg-white py-3.5 pl-5 pr-4 shadow-sm"
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <ManagerChip
                  auctionId={auctionId}
                  auctionUserId={row.user.id}
                  name={row.user.name}
                  teamName={row.user.team_name}
                  avatarUrl={row.user.avatar_url}
                  labelClassName="text-base font-medium"
                />
                {row.user.team_name?.trim() && (
                  <p className="mt-0.5 pl-6 text-xs text-slate-500">{row.user.name}</p>
                )}
                {row.user.is_relegated && (
                  <span className="mt-1.5 ml-6 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                    Relegated
                  </span>
                )}
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-sky-50/60 px-3 py-2 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-600">Remaining</dt>
                <dd className="font-mono tabular-nums text-slate-900">{row.user.budget_remaining}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">Disposable</dt>
                <dd className="font-mono tabular-nums text-slate-900">{row.user.active_budget}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">Players purchased</dt>
                <dd className="font-mono tabular-nums text-slate-900">{row.ownedCount}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">Bids held</dt>
                <dd className="font-mono tabular-nums text-slate-900">{row.bidsHeldCount}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] border-separate border-spacing-y-2 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Manager</th>
              <th className="w-28 px-3 py-2 font-semibold">Remaining</th>
              <th className="w-28 px-3 py-2 font-semibold">Disposable</th>
              <th className="w-28 px-3 py-2 font-semibold">Players purchased</th>
              <th className="w-28 px-3 py-2 font-semibold">Bids held</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.user.id}
                className="transition [&>td]:border-y [&>td]:border-sky-200 [&>td]:bg-white [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l-[6px] [&>td:first-child]:border-l-sky-400 [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r hover:[&>td]:bg-sky-50"
              >
                <td className="px-3 py-3">
                  <ManagerChip
                    auctionId={auctionId}
                    auctionUserId={row.user.id}
                    name={row.user.name}
                    teamName={row.user.team_name}
                    avatarUrl={row.user.avatar_url}
                    labelClassName="font-medium text-slate-900"
                  />
                  {row.user.team_name?.trim() && (
                    <div className="mt-0.5 pl-6 text-xs text-slate-500">{row.user.name}</div>
                  )}
                  {row.user.is_relegated && (
                    <span className="mt-1 ml-6 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Relegated
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 font-mono tabular-nums text-slate-900">
                  {row.user.budget_remaining}
                </td>
                <td className="px-3 py-3 font-mono tabular-nums text-slate-900">
                  {row.user.active_budget}
                </td>
                <td className="px-3 py-3 font-mono tabular-nums text-slate-900">
                  {row.ownedCount}
                </td>
                <td className="px-3 py-3 font-mono tabular-nums text-slate-900">
                  {row.bidsHeldCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
