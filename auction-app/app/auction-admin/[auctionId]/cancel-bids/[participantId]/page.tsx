import Link from "next/link";
import { notFound } from "next/navigation";

import { loadCompetitorView } from "@/lib/auction-dashboard";
import { getAuthUser } from "@/lib/auth/get-user";
import { adminCancelBid } from "../../actions";
import { CancelBidsClient, type HeldBid } from "./_components/CancelBidsClient";

export const dynamic = "force-dynamic";

export default async function AdminCancelBidsForParticipantPage({
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

  const bids: HeldBid[] = view.leading
    .slice()
    .sort((a, b) => (a.player_name ?? "").localeCompare(b.player_name ?? ""))
    .map((l) => ({
      player_id: l.player_id,
      player_name: l.player_name,
      position: l.position,
      club: l.club,
      amount: l.high_amount,
    }));

  const cancelBid = adminCancelBid.bind(null, auctionId);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/auction-admin/${auctionId}/cancel-bids`}
          className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
        >
          ← Back to participants
        </Link>
      </div>

      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
          Bids held by {participantName}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Cancelling a bid returns the player to the unsold market (biddable again) and credits the bid
          amount back to {participantName}&apos;s active budget. The previous bid is not restored.
        </p>
      </div>

      <CancelBidsClient
        participantId={participantId}
        participantName={participantName}
        bids={bids}
        cancelBid={cancelBid}
      />
    </section>
  );
}
