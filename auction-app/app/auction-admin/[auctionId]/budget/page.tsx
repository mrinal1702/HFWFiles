import { loadCompetitorsSummary } from "@/lib/auction-dashboard";
import { getAuthUser } from "@/lib/auth/get-user";
import { adminModifyBudget } from "../actions";
import { ModifyBudgetClient, type BudgetParticipant } from "./_components/ModifyBudgetClient";

export const dynamic = "force-dynamic";

export default async function AdminBudgetPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const user = await getAuthUser();
  const rows = await loadCompetitorsSummary(auctionId, user?.id ?? null);

  const participants: BudgetParticipant[] = rows.map((r) => ({
    id: r.user.id,
    name: r.user.name,
    team_name: r.user.team_name,
    budget_remaining: r.user.budget_remaining,
    active_budget: r.user.active_budget,
  }));

  const modifyBudget = adminModifyBudget.bind(null, auctionId);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Modify Budget</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Give or take money from a participant. Giving adds fresh money to both remaining and active
          budget. Taking can never push active (or remaining) budget below £0.
        </p>
      </div>

      <ModifyBudgetClient participants={participants} modifyBudget={modifyBudget} />
    </section>
  );
}
