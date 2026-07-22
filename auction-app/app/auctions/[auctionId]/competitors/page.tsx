import { ManagerChip } from "@/app/_components/entity/ManagerChip";
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
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Competitors</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Everyone can see each other&apos;s budgets. Tap a manager to view their team and the bids
          they&apos;re winning.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        {d.users.length === 0 ? (
          <p className="text-sm text-slate-600">No managers in this auction.</p>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {d.users.map((u, i) => (
                <li
                  key={u.id}
                  className={`rounded-xl border border-sky-100 px-4 py-4 shadow-sm ${
                    i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
                  }`}
                >
                  <ManagerChip
                    auctionId={auctionId}
                    auctionUserId={u.id}
                    name={u.name}
                    teamName={u.team_name}
                    avatarUrl={u.avatar_url}
                    labelClassName="text-base font-medium"
                  />
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
                  {d.users.map((u, i) => (
                    <tr
                      key={u.id}
                      className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-sky-50/50" : "bg-white"}`}
                    >
                      <td className="px-3 py-3">
                        <ManagerChip
                          auctionId={auctionId}
                          auctionUserId={u.id}
                          name={u.name}
                          teamName={u.team_name}
                          avatarUrl={u.avatar_url}
                          labelClassName="font-medium"
                        />
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
      </div>
    </section>
  );
}
