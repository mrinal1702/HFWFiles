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

type SectionId = "gk" | "def" | "mid" | "fwd" | "other";

const SECTION_ORDER: Array<{ id: SectionId; label: string }> = [
  { id: "gk", label: "Goalkeepers" },
  { id: "def", label: "Defenders" },
  { id: "mid", label: "Midfielders" },
  { id: "fwd", label: "Forwards" },
  { id: "other", label: "Other" },
];

function sectionForPosition(position: string | null | undefined): SectionId {
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

  // Compute budget from the summaries helper (re-uses the same query pattern)
  const summaries = await getParticipantSummaries(auctionId, auction.starting_budget);
  const mySummary = summaries.find((s) => s.id === participantId);
  const totalSpent = mySummary?.total_spent ?? 0;
  const budgetRemaining = mySummary?.budget_remaining ?? auction.starting_budget;

  // Group squad by position
  const enriched = squad.map((p) => ({ ...p, section: sectionForPosition(p.position) }));
  const grouped = SECTION_ORDER.map((section) => ({
    ...section,
    rows: enriched
      .filter((p) => p.section === section.id)
      .sort((a, b) => a.player_name.localeCompare(b.player_name)),
  })).filter((s) => s.rows.length > 0);

  return (
    <div className="space-y-5">
      {/* Participant header */}
      <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{participant.display_name}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {squad.length} player{squad.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href={`/live-auction/${auctionId}`}
            className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
          >
            ← Auction overview
          </Link>
        </div>

        {/* Budget stats */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-100 bg-slate-50 text-center text-sm">
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">Starting</div>
            <div className="mt-0.5 font-mono font-semibold text-slate-900">
              £{auction.starting_budget}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">Spent</div>
            <div className="mt-0.5 font-mono font-semibold text-slate-900">£{totalSpent}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs font-medium text-slate-500">Remaining</div>
            <div
              className={`mt-0.5 font-mono font-semibold ${
                budgetRemaining < 20 ? "text-red-700" : "text-slate-900"
              }`}
            >
              £{budgetRemaining}
            </div>
          </div>
        </div>
      </section>

      {/* Squad */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        {squad.length === 0 ? (
          <p className="text-sm text-slate-500">No players yet.</p>
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
                          <span className="font-mono text-sm font-medium text-slate-900">
                            £{player.price}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[player.team_name ?? player.nation, player.position]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          FotMob ID: {player.fotmob_player_id}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Player</th>
                    <th className="px-4 py-3 font-semibold">Club / Nation</th>
                    <th className="px-4 py-3 font-semibold">Position</th>
                    <th className="px-4 py-3 font-semibold">FotMob ID</th>
                    <th className="px-4 py-3 text-right font-semibold">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.flatMap((group, groupIdx) => [
                    <tr
                      key={`${group.id}-hdr`}
                      className={`bg-slate-100/70 ${groupIdx > 0 ? "border-t-2 border-slate-200" : ""}`}
                    >
                      <td
                        colSpan={5}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                      >
                        {group.label} ({group.rows.length})
                      </td>
                    </tr>,
                    ...group.rows.map((player: SquadPlayer, i) => (
                      <tr
                        key={player.sale_id}
                        className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-sky-50/50" : "bg-white"}`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {player.player_name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {player.team_name ?? player.nation ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{player.position ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {player.fotmob_player_id}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-900">
                          £{player.price}
                        </td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
