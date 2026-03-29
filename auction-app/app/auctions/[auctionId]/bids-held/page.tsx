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
      <p className="text-sm leading-relaxed text-neutral-500">
        Choose a manager in the header to see your leading bids.
      </p>
    );
  }

  const held = d.lots.filter((l) => l.status === "bidding" && l.high_bidder_id === d.me!.id);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div>
        <h2 className="text-lg font-semibold sm:text-xl">Bids held</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          Players where you are currently the high bidder. Past losing bids are not listed.
        </p>
      </div>
      {held.length === 0 ? (
        <p className="text-sm text-neutral-500">You are not leading on any open lots.</p>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {held.map((l) => (
              <li
                key={l.player_id}
                className="rounded-xl border border-neutral-800 bg-neutral-900/25 px-4 py-4"
              >
                <h3 className="text-base font-medium text-neutral-100">{l.player_name ?? "—"}</h3>
                <p className="mt-1 text-sm text-neutral-400">
                  {(l.club ?? "—") + " · " + (l.position ?? "—")}
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-500">Your bid</dt>
                    <dd className="font-mono text-neutral-100">{l.high_amount ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-500">Lot deadline</dt>
                    <dd className="max-w-[70%] text-right text-xs text-neutral-400">
                      {l.expires_at ? new Date(l.expires_at).toLocaleString() : "—"}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-neutral-800 md:block">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
                <tr>
                  <th className="px-3 py-3 font-medium">Player</th>
                  <th className="px-3 py-3 font-medium">Club</th>
                  <th className="px-3 py-3 font-medium">Pos</th>
                  <th className="px-3 py-3 font-medium">Your bid</th>
                  <th className="px-3 py-3 font-medium">Lot deadline (local)</th>
                </tr>
              </thead>
              <tbody>
                {held.map((l) => (
                  <tr key={l.player_id} className="border-b border-neutral-800/80">
                    <td className="px-3 py-3">{l.player_name ?? "—"}</td>
                    <td className="px-3 py-3 text-neutral-400">{l.club ?? "—"}</td>
                    <td className="px-3 py-3 text-neutral-400">{l.position ?? "—"}</td>
                    <td className="px-3 py-3 font-mono">{l.high_amount ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-neutral-400">
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
