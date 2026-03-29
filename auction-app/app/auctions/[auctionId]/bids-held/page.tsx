import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";

export const dynamic = "force-dynamic";

export default async function BidsHeldPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const d = await loadAuctionDashboardForViewer(Number(raw));

  if (!d.me) {
    return (
      <p className="text-sm leading-relaxed text-slate-600">
        Choose a manager in the header to see your leading bids.
      </p>
    );
  }

  const held = d.biddingClosed
    ? []
    : d.lots.filter((l) => l.status === "bidding" && l.high_bidder_id === d.me!.id);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Bids held</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Players where you are currently the high bidder on an open lot. After the hard deadline, leading bids are
          settled into rosters; check My team for players you won.
        </p>
      </div>
      {d.biddingClosed ? (
        <p className="text-sm text-slate-600">Bidding is closed — no open leading bids.</p>
      ) : held.length === 0 ? (
        <p className="text-sm text-slate-600">You are not leading on any open lots.</p>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {held.map((l) => (
              <li
                key={l.player_id}
                className="rounded-xl border border-sky-100 bg-white px-4 py-4 shadow-sm"
              >
                <h3 className="text-base font-medium text-slate-900">{l.player_name ?? "—"}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {(l.club ?? "—") + " · " + (l.position ?? "—")}
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Your bid</dt>
                    <dd className="font-mono font-medium text-slate-900">{l.high_amount ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Lot deadline</dt>
                    <dd className="max-w-[70%] text-right text-xs text-slate-600">
                      {l.expires_at ? new Date(l.expires_at).toLocaleString() : "—"}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
                <tr>
                  <th className="px-3 py-3 font-semibold">Player</th>
                  <th className="px-3 py-3 font-semibold">Club</th>
                  <th className="px-3 py-3 font-semibold">Pos</th>
                  <th className="px-3 py-3 font-semibold">Your bid</th>
                  <th className="px-3 py-3 font-semibold">Lot deadline (local)</th>
                </tr>
              </thead>
              <tbody>
                {held.map((l) => (
                  <tr key={l.player_id} className="border-b border-slate-100">
                    <td className="px-3 py-3 text-slate-900">{l.player_name ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{l.club ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{l.position ?? "—"}</td>
                    <td className="px-3 py-3 font-mono font-medium text-slate-900">{l.high_amount ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {l.expires_at ? new Date(l.expires_at).toLocaleString() : "—"}
                    </td>
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
