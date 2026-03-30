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

  const returnTo = `/auctions/${auctionId}/competitors/${competitorUserId}`;

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <Link
          href={`/auctions/${auctionId}/competitors`}
          className="inline-block min-h-10 py-2 text-sm font-medium text-sky-700 underline hover:text-sky-900"
        >
          ← Competitors
        </Link>
        <h2 className="mt-2 text-lg font-semibold text-slate-900 sm:text-xl">
          {v.competitor.name ?? `Manager #${competitorUserId}`}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">
          <div className="rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2">
            <div className="text-xs font-medium text-slate-600">budget_remaining</div>
            <div className="font-mono text-base tabular-nums text-slate-900">{v.competitor.budget_remaining}</div>
          </div>
          <div className="rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2">
            <div className="text-xs font-medium text-slate-600">active_budget</div>
            <div className="font-mono text-base tabular-nums text-slate-900">{v.competitor.active_budget}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">Roster</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Players they&apos;ve won in this auction.
        </p>
        {v.sold.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Nobody on their roster yet.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-3 md:hidden">
              {v.sold.map((l, i) => (
                <li
                  key={l.player_id}
                  className={`rounded-xl border border-sky-100 px-4 py-4 shadow-sm ${
                    i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={`/auctions/${auctionId}/players/${l.player_id}?returnTo=${encodeURIComponent(
                        returnTo,
                      )}`}
                      className="text-base font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {l.player_name ?? "—"}
                    </Link>
                    <span className="font-mono text-sm font-medium text-slate-900">{l.high_amount ?? "—"}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {(l.club ?? "—") + " · " + (l.position ?? "—")}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Player</th>
                    <th className="px-3 py-3 font-semibold">Club</th>
                    <th className="px-3 py-3 font-semibold">Pos</th>
                    <th className="px-3 py-3 font-semibold">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {v.sold.map((l, i) => (
                    <tr
                      key={l.player_id}
                      className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-sky-50/50" : "bg-white"}`}
                    >
                      <td className="px-3 py-3 text-slate-900">
                        <Link
                          href={`/auctions/${auctionId}/players/${l.player_id}?returnTo=${encodeURIComponent(
                            returnTo,
                          )}`}
                          className="hover:underline"
                        >
                          {l.player_name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{l.club ?? "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{l.position ?? "—"}</td>
                      <td className="px-3 py-3 font-mono font-medium text-slate-900">{l.high_amount ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">Bids they&apos;re winning</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          High bidder for now — someone else can still raise until the timer or auction deadline.
        </p>
        {v.leading.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">None right now.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-3 md:hidden">
              {v.leading.map((l, i) => (
                <li
                  key={l.player_id}
                  className={`rounded-xl border border-sky-100 px-4 py-4 shadow-sm ${
                    i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
                  }`}
                >
                  <h4 className="text-base font-medium text-slate-900">
                    <Link
                      href={`/auctions/${auctionId}/players/${l.player_id}?returnTo=${encodeURIComponent(
                        returnTo,
                      )}`}
                      className="hover:underline"
                    >
                      {l.player_name ?? "—"}
                    </Link>
                  </h4>
                  <p className="mt-1 text-sm text-slate-600">
                    {(l.club ?? "—") + " · " + (l.position ?? "—")}
                  </p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">Bid</dt>
                      <dd className="font-mono font-medium text-slate-900">{l.high_amount ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">Timer</dt>
                      <dd className="max-w-[70%] text-right text-xs text-slate-600">
                        {l.expires_at ? new Date(l.expires_at).toLocaleString() : "—"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Player</th>
                    <th className="px-3 py-3 font-semibold">Club</th>
                    <th className="px-3 py-3 font-semibold">Pos</th>
                    <th className="px-3 py-3 font-semibold">Bid</th>
                    <th className="px-3 py-3 font-semibold">Timer (local)</th>
                  </tr>
                </thead>
                <tbody>
                  {v.leading.map((l, i) => (
                    <tr
                      key={l.player_id}
                      className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-sky-50/50" : "bg-white"}`}
                    >
                      <td className="px-3 py-3 text-slate-900">
                        <Link
                          href={`/auctions/${auctionId}/players/${l.player_id}?returnTo=${encodeURIComponent(
                            returnTo,
                          )}`}
                          className="hover:underline"
                        >
                          {l.player_name ?? "—"}
                        </Link>
                      </td>
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
      </div>
    </section>
  );
}
