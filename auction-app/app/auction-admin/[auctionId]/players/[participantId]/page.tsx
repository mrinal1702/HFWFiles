import Link from "next/link";
import { notFound } from "next/navigation";

import { loadCompetitorView } from "@/lib/auction-dashboard";
import { getAuthUser } from "@/lib/auth/get-user";
import { SQUAD_SECTION_ORDER, squadSectionForPosition } from "@/lib/online-auction-admin";
import type { EnrichedLot } from "@/lib/auction-types";

export const dynamic = "force-dynamic";

function groupBySection(lots: EnrichedLot[]) {
  return SQUAD_SECTION_ORDER.map((section) => ({
    ...section,
    rows: lots
      .filter((l) => squadSectionForPosition(l.position) === section.id)
      .sort((a, b) => {
        const clubA = (a.club ?? "").toLowerCase();
        const clubB = (b.club ?? "").toLowerCase();
        if (clubA !== clubB) return clubA.localeCompare(clubB);
        return (a.player_name ?? "").localeCompare(b.player_name ?? "");
      }),
  })).filter((s) => s.rows.length > 0);
}

export default async function AdminParticipantProfilePage({
  params,
}: {
  params: Promise<{ auctionId: string; participantId: string }>;
}) {
  const { auctionId: rawA, participantId: rawP } = await params;
  const auctionId = Number(rawA);
  const participantId = Number(rawP);
  if (!Number.isFinite(participantId) || participantId <= 0) notFound();

  const user = await getAuthUser();
  const view = await loadCompetitorView(auctionId, participantId, user?.id ?? null);
  if (!view.competitor) notFound();

  const participant = view.competitor;
  const owned = view.sold;
  const bidsHeld = view.leading;
  const grouped = groupBySection(owned);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/auction-admin/${auctionId}/players`}
          className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
        >
          ← Back to participants
        </Link>
      </div>

      {/* Header + budget strip */}
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          {participant.name ?? `#${participant.id}`}
        </h2>
        {participant.team_name && (
          <p className="mt-0.5 text-sm text-slate-500">{participant.team_name}</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="rounded-lg border border-sky-100 bg-white px-3 py-2 shadow-sm">
            <div className="text-[11px] font-medium text-slate-600 sm:text-xs">Remaining budget</div>
            <div className="font-mono text-base tabular-nums text-slate-900">
              {participant.budget_remaining}
            </div>
          </div>
          <div className="rounded-lg border border-sky-100 bg-white px-3 py-2 shadow-sm">
            <div className="text-[11px] font-medium text-slate-600 sm:text-xs">Active budget</div>
            <div className="font-mono text-base tabular-nums text-slate-900">
              {participant.active_budget}
            </div>
          </div>
        </div>
      </div>

      {/* Current team */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">
          Current team <span className="text-sm font-normal text-slate-500">({owned.length})</span>
        </h3>
        {grouped.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No players on this team yet.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {grouped.map((group) => (
              <div key={group.id}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {group.label} ({group.rows.length})
                </h4>
                <ul className="mt-2 space-y-2">
                  {group.rows.map((t, i) => (
                    <li
                      key={t.player_id}
                      className={`flex items-center justify-between gap-3 rounded-xl border border-sky-100 px-4 py-3 shadow-sm ${
                        i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {t.player_name ?? `Player #${t.player_id}`}
                        </span>
                        <span className="block truncate text-xs text-slate-600">
                          {(t.club ?? "—") + " · " + (t.position ?? "—")}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm font-medium text-slate-900">
                        {t.high_amount ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bids held */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">
          Bids held <span className="text-sm font-normal text-slate-500">({bidsHeld.length})</span>
        </h3>
        {bidsHeld.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Not currently winning any bids.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {bidsHeld.map((l, i) => (
              <li
                key={l.player_id}
                className={`flex items-center justify-between gap-3 rounded-xl border border-amber-100 px-4 py-3 shadow-sm ${
                  i % 2 === 0 ? "bg-white" : "bg-amber-50/70"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {l.player_name ?? `Player #${l.player_id}`}
                  </span>
                  <span className="block truncate text-xs text-slate-600">
                    {(l.club ?? "—") + " · " + (l.position ?? "—")}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm font-medium text-slate-900">
                  {l.high_amount ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/auction-admin/${auctionId}/players/${participantId}/add`}
          className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          Add player
        </Link>
        <Link
          href={`/auction-admin/${auctionId}/players/${participantId}/remove`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Remove player
        </Link>
      </div>
    </section>
  );
}
