import Link from "next/link";

import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";

export const dynamic = "force-dynamic";

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const d = await loadAuctionDashboardForViewer(auctionId);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Competitors</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Budgets and rosters are public within this auction. Open a manager to see their team and current
          leading bids.
        </p>
      </div>
      {d.users.length === 0 ? (
        <p className="text-sm text-slate-600">No managers in this auction.</p>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {d.users.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/auctions/${auctionId}/competitors/${u.id}`}
                  className="block rounded-xl border border-sky-100 bg-white px-4 py-4 shadow-sm active:bg-sky-50"
                >
                  <span className="text-base font-medium text-sky-800 underline-offset-2 hover:underline">
                    {u.name ?? `Manager #${u.id}`}
                  </span>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-slate-600">Remaining</dt>
                      <dd className="font-mono font-medium text-slate-900">{u.budget_remaining}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-600">Active</dt>
                      <dd className="font-mono font-medium text-slate-900">{u.active_budget}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
                <tr>
                  <th className="px-3 py-3 font-semibold">Manager</th>
                  <th className="px-3 py-3 font-semibold">budget_remaining</th>
                  <th className="px-3 py-3 font-semibold">active_budget</th>
                </tr>
              </thead>
              <tbody>
                {d.users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="px-3 py-3">
                      <Link
                        href={`/auctions/${auctionId}/competitors/${u.id}`}
                        className="font-medium text-sky-800 underline hover:text-sky-950"
                      >
                        {u.name ?? `Manager #${u.id}`}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-mono font-medium text-slate-900">{u.budget_remaining}</td>
                    <td className="px-3 py-3 font-mono font-medium text-slate-900">{u.active_budget}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
