import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";

export const dynamic = "force-dynamic";

export default async function BidsHeldPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const d = await loadAuctionDashboardForViewer(auctionId);

  if (!d.me) {
    return (
      <p className="text-sm text-neutral-500">
        Choose a manager in the header to see your leading bids.
      </p>
    );
  }

  const held = d.lots.filter((l) => l.status === "bidding" && l.high_bidder_id === d.me!.id);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Bids held</h2>
      <p className="text-sm text-neutral-500">
        Players where you are currently the high bidder. Past losing bids are not listed.
      </p>
      {held.length === 0 ? (
        <p className="text-sm text-neutral-500">You are not leading on any open lots.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium">Club</th>
                <th className="px-3 py-2 font-medium">Pos</th>
                <th className="px-3 py-2 font-medium">Your bid</th>
                <th className="px-3 py-2 font-medium">Lot deadline (local)</th>
              </tr>
            </thead>
            <tbody>
              {held.map((l) => (
                <tr key={l.player_id} className="border-b border-neutral-800/80">
                  <td className="px-3 py-2">{l.player_name ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-400">{l.club ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-400">{l.position ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{l.high_amount ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-neutral-400">
                    {l.expires_at ? new Date(l.expires_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
