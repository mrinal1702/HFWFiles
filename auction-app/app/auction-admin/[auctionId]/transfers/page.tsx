import { createAdminClient } from "@/lib/supabase-server";
import { resolveAuctionCompetitionId } from "@/lib/players-query";
import { loadTransfersForAuction } from "@/lib/transfers";
import {
  adminApproveTransferAction,
  adminRejectTransferAction,
  adminSetTransferApproval,
} from "../actions";
import { TransferMonitorClient, type PendingTransfer } from "./_components/TransferMonitorClient";

export const dynamic = "force-dynamic";

export default async function AdminTransferMonitorPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);

  const admin = createAdminClient();
  const { data: auction } = await admin
    .from("Auctions")
    .select("id, competition_id, transfers_require_admin_approval")
    .eq("id", auctionId)
    .maybeSingle();

  const approvalOn = Boolean(
    (auction as { transfers_require_admin_approval?: boolean | null } | null)
      ?.transfers_require_admin_approval,
  );
  const competitionId = resolveAuctionCompetitionId(
    auction as { competition_id?: number | null } | null,
  );

  const { active } = await loadTransfersForAuction(admin, auctionId, competitionId);
  const pending: PendingTransfer[] = active
    .filter((t) => t.status === "pending_admin")
    .map((t) => ({
      id: t.id,
      proposerName: t.proposer_name ?? `#${t.proposer_id}`,
      recipientName: t.recipient_name ?? `#${t.recipient_id}`,
      proposerPlayers: t.proposer_players.map((p) => ({
        player_id: p.player_id,
        player_name: p.player_name,
        position: p.position,
      })),
      proposerCash: t.proposer_cash,
      recipientPlayers: t.recipient_players.map((p) => ({
        player_id: p.player_id,
        player_name: p.player_name,
        position: p.position,
      })),
      recipientCash: t.recipient_cash,
    }));

  const setApproval = adminSetTransferApproval.bind(null, auctionId);
  const approveTransfer = adminApproveTransferAction.bind(null, auctionId);
  const rejectTransfer = adminRejectTransferAction.bind(null, auctionId);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Transfer Monitor</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Decide whether transfers in this auction need your approval. When approval is ON, confirmed
          transfers wait here until you allow or disallow them.
        </p>
      </div>

      <TransferMonitorClient
        approvalOn={approvalOn}
        pendingTransfers={pending}
        setApproval={setApproval}
        approveTransfer={approveTransfer}
        rejectTransfer={rejectTransfer}
      />
    </section>
  );
}
