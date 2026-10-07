import Link from "next/link";
import { notFound } from "next/navigation";

import { loadCompetitorView } from "@/lib/auction-state/auction-dashboard";
import { getAuthUser } from "@/lib/auth/get-user";
import { SQUAD_SECTION_ORDER, squadSectionForPosition } from "@/lib/online-auction-admin";
import { adminRemovePlayerFromTeam } from "../../../actions";
import { RemovePlayerClient, type RemovableGroup } from "./_components/RemovePlayerClient";

export const dynamic = "force-dynamic";

export default async function AdminRemovePlayerPage({
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

  const participantName = view.competitor.name ?? `#${view.competitor.id}`;

  const groups: RemovableGroup[] = SQUAD_SECTION_ORDER.map((section) => ({
    id: section.id,
    label: section.label,
    rows: view.sold
      .filter((l) => squadSectionForPosition(l.position) === section.id)
      .sort((a, b) => {
        const clubA = (a.club ?? "").toLowerCase();
        const clubB = (b.club ?? "").toLowerCase();
        if (clubA !== clubB) return clubA.localeCompare(clubB);
        return (a.player_name ?? "").localeCompare(b.player_name ?? "");
      })
      .map((l) => ({
        player_id: l.player_id,
        player_name: l.player_name,
        position: l.position,
        club: l.club,
        price: l.high_amount,
      })),
  })).filter((g) => g.rows.length > 0);

  const removeAction = adminRemovePlayerFromTeam.bind(null, auctionId);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/auction-admin/${auctionId}/players/${participantId}`}
          className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
        >
          ← Back to {participantName}
        </Link>
      </div>

      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Remove a player from {participantName}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Removing a player returns them to the unsold player list as a free agent. Budget is not changed.
        </p>
      </div>

      <RemovePlayerClient
        participantId={participantId}
        participantName={participantName}
        groups={groups}
        removeAction={removeAction}
      />
    </section>
  );
}
