import Link from "next/link";

import { getAuthUser } from "@/lib/auth/get-user";
import {
  getLiveAuction,
  getParticipantSummaries,
  getRecentSalesPublic,
  getParticipantByUserId,
} from "@/lib/live-auction-data";

export const dynamic = "force-dynamic";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default async function LiveAuctionOverviewPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  const user = await getAuthUser();

  const [auction, summaries, recentSales] = await Promise.all([
    getLiveAuction(auctionId),
    getLiveAuction(auctionId).then((a) =>
      a ? getParticipantSummaries(auctionId, a.starting_budget) : [],
    ),
    getRecentSalesPublic(auctionId, 20),
  ]);

  if (!auction) return null; // layout handles 404

  // Check if the current user is an admin for this auction
  const myParticipant = user ? await getParticipantByUserId(auctionId, user.id) : null;
  const isAdmin = myParticipant?.role === "admin";

  return (
    <div className="space-y-6">
      {/* Admin link */}
      {isAdmin && (
        <div className="flex justify-end">
          <Link
            href={`/live-auction/${auctionId}/admin`}
            className="inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Admin — Record Sales →
          </Link>
        </div>
      )}

      {/* Participants table */}
      <section className="rounded-xl border border-sky-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Participants</h2>
        </div>
        {summaries.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">No participants yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Participant</th>
                  <th className="px-5 py-3 text-right font-medium">Players</th>
                  <th className="px-5 py-3 text-right font-medium">Spent</th>
                  <th className="px-5 py-3 text-right font-medium">Remaining</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-900">{p.display_name}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                      {p.players_count}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-700">
                      £{p.total_spent}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono tabular-nums font-semibold ${
                        p.budget_remaining < 20 ? "text-red-700" : "text-slate-900"
                      }`}
                    >
                      £{p.budget_remaining}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/live-auction/${auctionId}/team/${p.id}`}
                        className="text-xs font-medium text-sky-700 hover:underline"
                      >
                        View squad →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent sales log */}
      <section className="rounded-xl border border-sky-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Recent Sales</h2>
        </div>
        {recentSales.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">No sales recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Player</th>
                  <th className="px-5 py-3 font-medium">Participant</th>
                  <th className="px-5 py-3 text-right font-medium">Price</th>
                  <th className="px-5 py-3 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale, i) => (
                  <tr
                    key={sale.id}
                    className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-slate-50/60" : "bg-white"}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-900">{sale.player_name}</td>
                    <td className="px-5 py-3 text-slate-700">{sale.participant_name}</td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums font-medium text-slate-900">
                      £{sale.price}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-slate-500">
                      {formatTime(sale.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
