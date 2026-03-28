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
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Competitors</h2>
      <p className="text-sm text-neutral-500">
        Budgets and rosters are public within this auction. Open a manager to see their team and current
        leading bids.
      </p>
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
            <tr>
              <th className="px-3 py-2 font-medium">Manager</th>
              <th className="px-3 py-2 font-medium">budget_remaining</th>
              <th className="px-3 py-2 font-medium">active_budget</th>
            </tr>
          </thead>
          <tbody>
            {d.users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-800/80">
                <td className="px-3 py-2">
                  <Link
                    href={`/auctions/${auctionId}/competitors/${u.id}`}
                    className="text-neutral-200 underline hover:text-white"
                  >
                    {u.name ?? `Manager #${u.id}`}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono">{u.budget_remaining}</td>
                <td className="px-3 py-2 font-mono">{u.active_budget}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d.users.length === 0 && (
        <p className="text-sm text-neutral-500">No managers in this auction.</p>
      )}
    </section>
  );
}
