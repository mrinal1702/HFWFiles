import { notFound, redirect } from "next/navigation";

import { RespondTransferClient } from "@/app/auctions/[auctionId]/transfers/[transferId]/respond/_components/RespondTransferClient";
import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";
import { createAdminClient } from "@/lib/supabase-server";
import type { AuctionTransfer } from "@/lib/transfers";

export const dynamic = "force-dynamic";

const POS_ORDER: Record<string, number> = {
  gk: 0,
  goalkeeper: 0,
  defender: 1,
  cb: 1,
  lb: 1,
  rb: 1,
  midfielder: 2,
  cm: 2,
  am: 2,
  dm: 2,
  forward: 3,
  st: 3,
  lw: 3,
  rw: 3,
};

export default async function RespondToTransferPage({
  params,
}: {
  params: Promise<{ auctionId: string; transferId: string }>;
}) {
  const { auctionId: rawAuction, transferId } = await params;
  const auctionId = Number(rawAuction);

  const d = await loadAuctionDashboardForViewer(auctionId);
  if (!d.me) notFound();

  const admin = createAdminClient();

  // Check transfer window is still open
  const { data: auctionRow } = await admin
    .from("Auctions")
    .select("transfer_window_open, hard_deadline_at")
    .eq("id", auctionId)
    .maybeSingle();

  const transferWindowOpen =
    (auctionRow as { transfer_window_open?: boolean } | null)?.transfer_window_open ?? false;
  const pastHard = d.auction?.hard_deadline_at
    ? Date.now() >= Date.parse(d.auction.hard_deadline_at)
    : false;

  if (!transferWindowOpen || pastHard) {
    redirect(`/auctions/${auctionId}/transfers`);
  }

  // Load the transfer
  const { data: rawTransfer, error: tErr } = await admin
    .from("auction_transfers")
    .select("*")
    .eq("id", transferId)
    .eq("auction_id", auctionId)
    .maybeSingle();

  if (tErr) throw new Error(tErr.message);
  if (!rawTransfer) notFound();

  const transfer = rawTransfer as AuctionTransfer;

  // Guard: only recipient can respond, and only when awaiting_response
  if (transfer.recipient_id !== d.me.id || transfer.status !== "awaiting_response") {
    redirect(`/auctions/${auctionId}/transfers`);
  }

  // ── Load proposer info ───────────────────────────────────────────────────
  const proposerUser = d.users.find((u) => u.id === transfer.proposer_id);

  // Proposer's players (those they're sending)
  const proposerPlayers: { player_id: string; player_name: string | null; position: string | null }[] = [];
  if (transfer.proposer_player_ids.length > 0) {
    const { data: pp } = await admin
      .from("players")
      .select("player_id, player_name, position")
      .in("player_id", transfer.proposer_player_ids);
    for (const pid of transfer.proposer_player_ids) {
      const found = (pp ?? []).find(
        (p: { player_id: string }) => String(p.player_id) === pid,
      ) as { player_id: string; player_name: string | null; position: string | null } | undefined;
      proposerPlayers.push({
        player_id: pid,
        player_name: found?.player_name ?? null,
        position: found?.position ?? null,
      });
    }
  }

  // ── Load my (recipient's) squad ──────────────────────────────────────────
  const { data: teamRows, error: teamErr } = await admin
    .from("auction_teams")
    .select("player_id")
    .eq("auction_id", auctionId)
    .eq("auction_user_id", d.me.id);

  if (teamErr) throw new Error(teamErr.message);
  const myPlayerIds = (teamRows ?? []).map((r: { player_id: string }) => String(r.player_id));

  const playerMeta: Record<string, { player_name: string | null; position: string | null; club: string | null }> = {};
  if (myPlayerIds.length > 0) {
    const { data: playerRows } = await admin
      .from("players")
      .select("player_id, player_name, position, team_name")
      .in("player_id", myPlayerIds);
    for (const p of playerRows ?? []) {
      const row = p as { player_id: string; player_name: string | null; position: string | null; team_name: string | null };
      playerMeta[String(row.player_id)] = {
        player_name: row.player_name,
        position: row.position,
        club: row.team_name,
      };
    }
  }

  // Find my locked players (in another active transfer as recipient)
  const { data: activeTransfers } = await admin
    .from("auction_transfers")
    .select("recipient_player_ids")
    .eq("auction_id", auctionId)
    .not("status", "in", '("completed","rejected","cancelled")')
    .eq("recipient_id", d.me.id)
    .neq("id", transferId);

  const lockedPlayerIds = new Set<string>(
    (activeTransfers ?? []).flatMap(
      (t: { recipient_player_ids: string[] }) => t.recipient_player_ids,
    ),
  );

  const mySquad = [...myPlayerIds]
    .map((pid) => ({
      player_id: pid,
      player_name: playerMeta[pid]?.player_name ?? null,
      position: playerMeta[pid]?.position ?? null,
      club: playerMeta[pid]?.club ?? null,
      locked: lockedPlayerIds.has(pid),
    }))
    .sort((a, b) => {
      const pa = POS_ORDER[a.position?.toLowerCase() ?? ""] ?? 4;
      const pb = POS_ORDER[b.position?.toLowerCase() ?? ""] ?? 4;
      if (pa !== pb) return pa - pb;
      return (a.player_name ?? "").localeCompare(b.player_name ?? "");
    });

  return (
    <RespondTransferClient
      auctionId={auctionId}
      transferId={transferId}
      proposerName={proposerUser?.name ?? "A manager"}
      proposerPlayers={proposerPlayers}
      proposerCash={transfer.proposer_cash}
      proposerBudget={{
        budget_remaining: proposerUser?.budget_remaining ?? 0,
        active_budget: proposerUser?.active_budget ?? 0,
      }}
      mySquad={mySquad}
      myName={d.me.name ?? "You"}
      myBudget={{
        budget_remaining: d.me.budget_remaining,
        active_budget: d.me.active_budget,
      }}
    />
  );
}
