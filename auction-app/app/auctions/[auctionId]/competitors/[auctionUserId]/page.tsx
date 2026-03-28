import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthUser } from "@/lib/auth/get-user";
import { loadCompetitorView } from "@/lib/auction-dashboard";

export const dynamic = "force-dynamic";

export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ auctionId: string; auctionUserId: string }>;
}) {
  const { auctionId: aRaw, auctionUserId: uRaw } = await params;
  const auctionId = Number(aRaw);
  const competitorUserId = Number(uRaw);
  if (!Number.isFinite(competitorUserId)) {
    notFound();
  }

  const user = await getAuthUser();
  const v = await loadCompetitorView(auctionId, competitorUserId, user?.id ?? null);
  if (!v.competitor) {
    notFound();
  }

  return (
    <section className="space-y-8">
      <div>
        <Link
          href={`/auctions/${auctionId}/competitors`}
          className="text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          ← Competitors
        </Link>
        <h2 className="mt-3 text-lg font-semibold">
          {v.competitor.name ?? `Manager #${competitorUserId}`}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          budget_remaining{" "}
          <span className="font-mono text-neutral-300">{v.competitor.budget_remaining}</span>
          <span className="mx-2 text-neutral-600">·</span>
          active_budget{" "}
          <span className="font-mono text-neutral-300">{v.competitor.active_budget}</span>
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold">Drafted team (sold)</h3>
        <p className="mt-1 text-sm text-neutral-500">Players won by this manager in this auction only.</p>
        {v.sold.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No sold players yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Player</th>
                  <th className="px-3 py-2 font-medium">Club</th>
                  <th className="px-3 py-2 font-medium">Pos</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                </tr>
              </thead>
              <tbody>
                {v.sold.map((l) => (
                  <tr key={l.player_id} className="border-b border-neutral-800/80">
                    <td className="px-3 py-2">{l.player_name ?? "—"}</td>
                    <td className="px-3 py-2 text-neutral-400">{l.club ?? "—"}</td>
                    <td className="px-3 py-2 text-neutral-400">{l.position ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{l.high_amount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold">Leading bids</h3>
        <p className="mt-1 text-sm text-neutral-500">Open lots where this manager is the high bidder.</p>
        {v.leading.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">None right now.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Player</th>
                  <th className="px-3 py-2 font-medium">Club</th>
                  <th className="px-3 py-2 font-medium">Pos</th>
                  <th className="px-3 py-2 font-medium">Bid</th>
                  <th className="px-3 py-2 font-medium">Deadline (local)</th>
                </tr>
              </thead>
              <tbody>
                {v.leading.map((l) => (
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
      </div>
    </section>
  );
}
