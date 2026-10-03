import Link from "next/link";
import { notFound } from "next/navigation";

import { loadAuctionDashboard } from "@/lib/auction-dashboard";
import { getAuthUser } from "@/lib/auth/get-user";
import { positionSortRank } from "@/lib/online-auction-admin";
import { adminAddPlayerToTeam } from "../../../actions";
import { AddPlayerClient, type FreeAgent } from "./_components/AddPlayerClient";

export const dynamic = "force-dynamic";

export default async function AdminAddPlayerPage({
  params,
}: {
  params: Promise<{ auctionId: string; participantId: string }>;
}) {
  const { auctionId: rawA, participantId: rawP } = await params;
  const auctionId = Number(rawA);
  const participantId = Number(rawP);
  if (!Number.isFinite(participantId) || participantId <= 0) notFound();

  const user = await getAuthUser();
  const d = await loadAuctionDashboard(auctionId, user?.id ?? null);
  const participant = d.users.find((u) => u.id === participantId);
  if (!participant) notFound();

  // Free agents: not sold, no active bid.
  const freeAgents: FreeAgent[] = d.lots
    .filter((l) => l.status === "uninitiated" || l.status === "unsold")
    .map((l) => ({
      player_id: l.player_id,
      player_name: l.player_name,
      position: l.position,
      club: l.club,
    }))
    .sort((a, b) => {
      const clubA = (a.club ?? "").toLowerCase();
      const clubB = (b.club ?? "").toLowerCase();
      if (clubA !== clubB) return clubA.localeCompare(clubB);
      const pa = positionSortRank(a.position);
      const pb = positionSortRank(b.position);
      if (pa !== pb) return pa - pb;
      return (a.player_name ?? "").localeCompare(b.player_name ?? "");
    });

  const addAction = adminAddPlayerToTeam.bind(null, auctionId);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/auction-admin/${auctionId}/players/${participantId}`}
          className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
        >
          ← Back to {participant.name ?? "participant"}
        </Link>
      </div>

      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Add a player to {participant.name ?? `#${participant.id}`}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Free agents only (unsold players with no active bid). Choose a player, then set the buy price.
          Budget is <span className="font-medium text-slate-800">not</span> deducted.
        </p>
      </div>

      <AddPlayerClient
        participantId={participantId}
        participantName={participant.name ?? `#${participant.id}`}
        freeAgents={freeAgents}
        addAction={addAction}
      />
    </section>
  );
}
