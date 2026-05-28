import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getLiveAuction,
  getParticipantById,
  getParticipantSquad,
  getParticipantSummaries,
} from "@/lib/live-auction-data";
import type { SquadPlayer } from "@/lib/live-auction-types";

export const dynamic = "force-dynamic";

type PositionSection = "gk" | "def" | "mid" | "fwd" | "other";

const SECTION_ORDER: Array<{ id: PositionSection; label: string }> = [
  { id: "gk", label: "Goalkeepers" },
  { id: "def", label: "Defenders" },
  { id: "mid", label: "Midfielders" },
  { id: "fwd", label: "Forwards" },
  { id: "other", label: "Other" },
];

function categorizePosition(position: string | null | undefined): PositionSection {
  const p = (position ?? "").trim().toLowerCase();
  if (p === "gk" || p.includes("goalkeeper")) return "gk";
  if (p.includes("defend")) return "def";
  if (p.includes("midfield")) return "mid";
  if (p.includes("forward") || p.includes("attack") || p.includes("striker")) return "fwd";
  return "other";
}

export default async function ParticipantSquadPage({
  params,
}: {
  params: Promise<{ auctionId: string; participantId: string }>;
}) {
  const { auctionId, participantId } = await params;

  const [auction, participant, squad] = await Promise.all([
    getLiveAuction(auctionId),
    getParticipantById(participantId),
    getParticipantSquad(auctionId, participantId),
  ]);

  if (!auction || !participant || participant.auction_id !== auctionId) {
    notFound();
  }

  const summaries = await getParticipantSummaries(auctionId, auction.starting_budget);
  const mySummary = summaries.find((s) => s.id === participantId);
  const totalSpent = mySummary?.total_spent ?? 0;
  const budgetRemaining = mySummary?.budget_remaining ?? auction.starting_budget;
  const slotsUsed = mySummary?.players_count ?? 0;
  const slotsLeft = auction.squad_size - slotsUsed;
  const spentPct = auction.starting_budget > 0
    ? Math.min(100, (totalSpent / auction.starting_budget) * 100)
    : 0;
  const budgetLow = budgetRemaining < 20;

  // Group by position, sort by price desc within each group
  const grouped = SECTION_ORDER.map((section) => ({
    ...section,
    rows: squad
      .filter((p) => categorizePosition(p.position) === section.id)
      .sort((a, b) => b.price - a.price),
  })).filter((s) => s.rows.length > 0);

  return (
    <div className="space-y-5">
      {/* Header card */}
      <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{participant.display_name}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {slotsUsed} player{slotsUsed !== 1 ? "s" : ""} signed ·{" "}
              <span className={slotsLeft === 0 ? "font-medium text-green-700" : ""}>
                {slotsLeft} slot{slotsLeft !== 1 ? "s" : ""} remaining
              </span>
            </p>
          </div>
          <Link
            href={`/live-auction/${auctionId}`}
            className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
          >
            ← Auction overview
          </Link>
        </div>

        {/* Budget bar */}
        <div className="mt-4">
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-slate-500">
              Spent £{totalSpent} of £{auction.starting_budget}
            </span>
            <span className={`font-mono font-semibold ${budgetLow ? "text-red-700" : "text-slate-900"}`}>
              £{budgetRemaining} left
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full transition-all ${budgetLow ? "bg-red-500" : "bg-sky-500"}`}
              style={{ width: `${spentPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Squad */}
      {squad.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm text-slate-500">No players signed yet.</p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-5 md:hidden">
            {grouped.map((group, groupIdx) => (
              <div key={group.id} className={groupIdx > 0 ? "pt-1" : ""}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {group.label} ({group.rows.length})
                </h3>
                <ul className="mt-2 space-y-2">
                  {group.rows.map((player) => (
                    <li
                      key={player.sale_id}
                      className="rounded-xl border border-sky-100 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-slate-900">{player.player_name}</span>
                        <span className="font-mono text-sm font-semibold text-slate-900">
                          £{player.price}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[player.team_name ?? player.nation, player.position]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-sky-100 bg-white shadow-sm md:block">
            {grouped.map((group, groupIdx) => (
              <div key={group.id}>
                <div
                  className={`border-b border-slate-100 bg-slate-50 px-5 py-2.5 ${
                    groupIdx > 0 ? "border-t-2 border-slate-200" : ""
                  }`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {group.label} ({group.rows.length})
                  </span>
                </div>
                {group.rows.map((player: SquadPlayer, i) => (
                  <div
                    key={player.sale_id}
                    className={`flex items-center border-b border-slate-100 px-5 py-3 last:border-b-0 ${
                      i % 2 === 1 ? "bg-sky-50/40" : "bg-white"
                    }`}
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900">
                        {player.player_name}
                      </span>
                    </div>
                    <div className="w-40 text-sm text-slate-500">
                      {player.team_name ?? player.nation ?? "—"}
                    </div>
                    <div className="w-28 text-sm text-slate-500">
                      {player.position ?? "—"}
                    </div>
                    <div className="w-20 text-right font-mono text-sm font-semibold text-slate-900">
                      £{player.price}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
