import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/get-user";
import { userHasLiveAuctionAdminAccess } from "@/lib/live-auction-auth";
import {
  getLiveAuction,
  getAvailablePlayers,
  getAllPlayersWithSaleInfo,
  getLiveAuctionBidders,
  getRecentSales,
  getParticipantSummaries,
} from "@/lib/live-auction-data";
import type { ParticipantSummary } from "@/lib/live-auction-types";
import { recordSaleAction, voidSaleAction, editSaleAction } from "./actions";
import { AdminSaleSection } from "./_components/AdminSaleSection";
import { SalesLog } from "./_components/SalesLog";
import { UndoLastSale } from "./_components/UndoLastSale";

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

  // Only users who redeemed admin_code on the dashboard may access this page
  const isAdmin = await userHasLiveAuctionAdminAccess(auctionId, user.id);
  if (!isAdmin) {
    redirect("/dashboard?error=not_admin");
  }

  // Load auction first so starting_budget is available for participant summaries
  const auction = await getLiveAuction(auctionId);
  if (!auction) redirect("/dashboard");

  const [availablePlayers, allPlayers, participants, recentSales, participantSummaries] =
    await Promise.all([
      getAvailablePlayers(auctionId),
      getAllPlayersWithSaleInfo(auctionId),
      getLiveAuctionBidders(auctionId),
      getRecentSales(auctionId, 30),
      // All non-voided sales (no limit) — used for accurate budget totals
      getParticipantSummaries(auctionId, auction.starting_budget),
    ]);

  // Bind auctionId into each server action so client components receive
  // a (prevState, formData) => Promise<State> signature for useActionState.
  const boundRecordSale = recordSaleAction.bind(null, auctionId);
  const boundVoidSale = voidSaleAction.bind(null, auctionId);
  const boundEditSale = editSaleAction.bind(null, auctionId);

  // Most recent non-voided sale — used for the Undo Last Sale widget
  const lastSale = recentSales.find((s) => !s.is_voided) ?? null;

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
          href="/dashboard"
          className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Undo last sale — quick correction widget */}
      <UndoLastSale lastSale={lastSale} voidSale={boundVoidSale} />

      {/* Two-column layout on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Sale form (search or team-browse) */}
        <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Record a Sale</h3>
          <AdminSaleSection
            availablePlayers={availablePlayers}
            allPlayers={allPlayers}
            participants={participants}
            recordSale={boundRecordSale}
            editSale={boundEditSale}
          />
        </section>

        {/* Right: Budgets at a glance */}
        <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Budgets</h3>
          {participantSummaries.length === 0 ? (
            <p className="text-sm text-slate-500">No participants yet.</p>
          ) : (
            <BudgetTable
              summaries={participantSummaries}
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
// Uses pre-computed ParticipantSummary rows (all non-voided sales, no limit)
// so the remaining budget is always accurate regardless of total sale count.

function BudgetTable({
  summaries,
  auctionId,
}: {
  summaries: ParticipantSummary[];
  auctionId: string;
}) {
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
        {summaries.map((p) => (
          <tr key={p.id} className="border-b border-slate-50">
            <td className="py-2">
              <Link
                href={`/live-auction/${auctionId}/team/${p.id}`}
                className="font-medium text-slate-900 hover:text-sky-700 hover:underline"
              >
                {p.display_name}
              </Link>
            </td>
            <td className="py-2 text-right tabular-nums text-slate-600">{p.players_count}</td>
            <td
              className={`py-2 text-right font-mono tabular-nums font-semibold ${
                p.budget_remaining < 20 ? "text-red-700" : "text-slate-900"
              }`}
            >
              £{p.budget_remaining}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
