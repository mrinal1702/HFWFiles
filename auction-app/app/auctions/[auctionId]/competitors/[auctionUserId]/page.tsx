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
    <section className="space-y-8 sm:space-y-10">
      <div>
        <Link
          href={`/auctions/${auctionId}/competitors`}
          className="inline-block min-h-10 py-2 text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          ← Competitors
        </Link>
        <h2 className="mt-2 text-lg font-semibold sm:text-xl">
          {v.competitor.name ?? `Manager #${competitorUserId}`}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
            <div className="text-xs text-neutral-500">budget_remaining</div>
            <div className="font-mono text-base text-neutral-200 tabular-nums">{v.competitor.budget_remaining}</div>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
            <div className="text-xs text-neutral-500">active_budget</div>
            <div className="font-mono text-base text-neutral-200 tabular-nums">{v.competitor.active_budget}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold">Drafted team (sold)</h3>
        <p className="mt-1 text-sm leading-relaxed text-neutral-500">
          Players won by this manager in this auction only.
        </p>
        {v.sold.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No sold players yet.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-3 md:hidden">
              {v.sold.map((l) => (
                <li
                  key={l.player_id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/25 px-4 py-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-base font-medium text-neutral-100">{l.player_name ?? "—"}</span>
                    <span className="font-mono text-sm text-neutral-200">{l.high_amount ?? "—"}</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-400">
                    {(l.club ?? "—") + " · " + (l.position ?? "—")}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-4 hidden overflow-x-auto rounded-lg border border-neutral-800 md:block">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
                  <tr>
                    <th className="px-3 py-3 font-medium">Player</th>
                    <th className="px-3 py-3 font-medium">Club</th>
                    <th className="px-3 py-3 font-medium">Pos</th>
                    <th className="px-3 py-3 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {v.sold.map((l) => (
                    <tr key={l.player_id} className="border-b border-neutral-800/80">
                      <td className="px-3 py-3">{l.player_name ?? "—"}</td>
                      <td className="px-3 py-3 text-neutral-400">{l.club ?? "—"}</td>
                      <td className="px-3 py-3 text-neutral-400">{l.position ?? "—"}</td>
                      <td className="px-3 py-3 font-mono">{l.high_amount ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold">Leading bids</h3>
        <p className="mt-1 text-sm leading-relaxed text-neutral-500">
          Open lots where this manager is the high bidder.
        </p>
        {v.leading.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">None right now.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-3 md:hidden">
              {v.leading.map((l) => (
                <li
                  key={l.player_id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/25 px-4 py-4"
                >
                  <h4 className="text-base font-medium text-neutral-100">{l.player_name ?? "—"}</h4>
                  <p className="mt-1 text-sm text-neutral-400">
                    {(l.club ?? "—") + " · " + (l.position ?? "—")}
                  </p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Bid</dt>
                      <dd className="font-mono text-neutral-100">{l.high_amount ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Deadline</dt>
                      <dd className="max-w-[70%] text-right text-xs text-neutral-400">
                        {l.expires_at ? new Date(l.expires_at).toLocaleString() : "—"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="mt-4 hidden overflow-x-auto rounded-lg border border-neutral-800 md:block">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
                  <tr>
                    <th className="px-3 py-3 font-medium">Player</th>
                    <th className="px-3 py-3 font-medium">Club</th>
                    <th className="px-3 py-3 font-medium">Pos</th>
                    <th className="px-3 py-3 font-medium">Bid</th>
                    <th className="px-3 py-3 font-medium">Deadline (local)</th>
                  </tr>
                </thead>
                <tbody>
                  {v.leading.map((l) => (
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
      </div>
    </section>
  );
}
