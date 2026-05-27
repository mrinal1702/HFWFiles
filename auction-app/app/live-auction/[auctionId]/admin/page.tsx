import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/get-user";
import {
  getLiveAuction,
  getAvailablePlayers,
  getLiveAuctionParticipants,
  getRecentSales,
  getParticipantByUserId,
} from "@/lib/live-auction-data";
import { recordSaleAction, voidSaleAction, editSaleAction } from "./actions";
import { SaleForm } from "./_components/SaleForm";
import { SalesLog } from "./_components/SalesLog";

export const dynamic = "force-dynamic";

export default async function LiveAuctionAdminPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;

  const user = await getAuthUser();
  if (!user) {
    redirect(`/login?next=/live-auction/${auctionId}/admin`);
  }

  // Only admins may access this page
  const myParticipant = await getParticipantByUserId(auctionId, user.id);
  if (!myParticipant || myParticipant.role !== "admin") {
    redirect(`/live-auction/${auctionId}`);
  }

  const [auction, availablePlayers, participants, recentSales] = await Promise.all([
    getLiveAuction(auctionId),
    getAvailablePlayers(auctionId),
    getLiveAuctionParticipants(auctionId),
    getRecentSales(auctionId, 30),
  ]);

  if (!auction) redirect("/live-auction");

  // Bind auctionId into each server action so client components receive
  // a (prevState, formData) => Promise<State> signature for useActionState.
  const boundRecordSale = recordSaleAction.bind(null, auctionId);
  const boundVoidSale = voidSaleAction.bind(null, auctionId);
  const boundEditSale = editSaleAction.bind(null, auctionId);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Admin — Record Sales</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {availablePlayers.length} player{availablePlayers.length !== 1 ? "s" : ""} available ·{" "}
            {recentSales.filter((s) => !s.is_voided).length} sold
          </p>
        </div>
        <Link
          href={`/live-auction/${auctionId}`}
          className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
        >
          ← Auction overview
        </Link>
      </div>

      {/* Two-column layout on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Sale form */}
        <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Record a Sale</h3>
          {availablePlayers.length === 0 ? (
            <p className="text-sm text-slate-500">
              No players available — all have been sold or marked as unsold.
            </p>
          ) : (
            <SaleForm
              players={availablePlayers}
              participants={participants}
              recordSale={boundRecordSale}
            />
          )}
        </section>

        {/* Right: Budgets at a glance */}
        <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Budgets</h3>
          {participants.length === 0 ? (
            <p className="text-sm text-slate-500">No participants yet.</p>
          ) : (
            <BudgetTable
              participants={participants}
              sales={recentSales.filter((s) => !s.is_voided)}
              startingBudget={auction.starting_budget}
              auctionId={auctionId}
            />
          )}
        </section>
      </div>

      {/* Recent sales log */}
      <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="mb-4 text-base font-semibold text-slate-900">
          Recent Sales
          <span className="ml-2 text-sm font-normal text-slate-500">(last 30)</span>
        </h3>
        <SalesLog
          sales={recentSales}
          participants={participants}
          voidSale={boundVoidSale}
          editSale={boundEditSale}
        />
      </section>
    </div>
  );
}

// ─── Budget table (server component — no interactivity needed) ────────────────

function BudgetTable({
  participants,
  sales,
  startingBudget,
  auctionId,
}: {
  participants: Awaited<ReturnType<typeof getLiveAuctionParticipants>>;
  sales: Awaited<ReturnType<typeof getRecentSales>>;
  startingBudget: number;
  auctionId: string;
}) {
  // Compute budget remaining per participant from the sales passed in
  const spentMap: Record<string, { total: number; count: number }> = {};
  for (const sale of sales) {
    const s = spentMap[sale.participant_id];
    spentMap[sale.participant_id] = {
      total: (s?.total ?? 0) + sale.price,
      count: (s?.count ?? 0) + 1,
    };
  }

  const rows = participants.map((p) => ({
    ...p,
    spent: spentMap[p.id]?.total ?? 0,
    count: spentMap[p.id]?.count ?? 0,
    remaining: startingBudget - (spentMap[p.id]?.total ?? 0),
  }));

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
        <tr>
          <th className="pb-2 font-medium">Participant</th>
          <th className="pb-2 text-right font-medium">Pl</th>
          <th className="pb-2 text-right font-medium">Remaining</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id} className="border-b border-slate-50">
            <td className="py-2">
              <Link
                href={`/live-auction/${auctionId}/team/${p.id}`}
                className="font-medium text-slate-900 hover:text-sky-700 hover:underline"
              >
                {p.display_name}
              </Link>
            </td>
            <td className="py-2 text-right tabular-nums text-slate-600">{p.count}</td>
            <td
              className={`py-2 text-right font-mono tabular-nums font-semibold ${
                p.remaining < 20 ? "text-red-700" : "text-slate-900"
              }`}
            >
              £{p.remaining}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
