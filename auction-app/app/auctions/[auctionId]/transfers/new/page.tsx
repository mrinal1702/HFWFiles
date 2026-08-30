import { notFound, redirect } from "next/navigation";

import { ProposeTransferClient } from "@/app/auctions/[auctionId]/transfers/new/_components/ProposeTransferClient";
import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";
import { fetchPlayerMetaByIds, resolveAuctionCompetitionId } from "@/lib/players-query";
import { createAdminClient } from "@/lib/supabase-server";

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

function sortByPosition<T extends { position: string | null; player_name: string | null }>(
  players: T[],
): T[] {
  return [...players].sort((a, b) => {
    const pa = POS_ORDER[a.position?.toLowerCase() ?? ""] ?? 4;
    const pb = POS_ORDER[b.position?.toLowerCase() ?? ""] ?? 4;
    if (pa !== pb) return pa - pb;
    return (a.player_name ?? "").localeCompare(b.player_name ?? "");
  });
}

export default async function NewTransferPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);

  const d = await loadAuctionDashboardForViewer(auctionId);
  if (!d.me) notFound();
  if (d.me.is_relegated) {
    redirect(`/auctions/${auctionId}/transfers`);
  }

  const admin = createAdminClient();

  // Check transfer window
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

  // ── Load all team rosters for this auction in one query ──────────────────
  const { data: allTeamRows, error: teamErr } = await admin
    .from("auction_teams")
    .select("player_id, auction_user_id")
    .eq("auction_id", auctionId);

  if (teamErr) throw new Error(teamErr.message);

  const allPlayerIds = [...new Set((allTeamRows ?? []).map((r: { player_id: string }) => String(r.player_id)))];

  const competitionId = resolveAuctionCompetitionId(d.auction);
  const playerMeta = await fetchPlayerMetaByIds(admin, allPlayerIds, competitionId);

  // Find my locked players (in an active transfer as proposer or recipient)
  const { data: activeTransfers } = await admin
    .from("auction_transfers")
    .select("proposer_player_ids, recipient_player_ids, proposer_id, recipient_id")
    .eq("auction_id", auctionId)
    .not("status", "in", '("completed","rejected","cancelled")');

  const lockedPlayerIds = new Set<string>(
    (activeTransfers ?? []).flatMap((t: { proposer_player_ids: string[]; recipient_player_ids: string[]; proposer_id: number; recipient_id: number }) => {
      const ids: string[] = [];
      if (t.proposer_id === d.me!.id) ids.push(...t.proposer_player_ids);
      if (t.recipient_id === d.me!.id) ids.push(...t.recipient_player_ids);
      return ids;
    }),
  );

  // Build my squad
  const myRawIds = (allTeamRows ?? [])
    .filter((r: { auction_user_id: number }) => r.auction_user_id === d.me!.id)
    .map((r: { player_id: string }) => String(r.player_id));

  const mySquad = sortByPosition(
    myRawIds.map((pid) => ({
      player_id: pid,
      player_name: playerMeta[pid]?.player_name ?? null,
      position: playerMeta[pid]?.position ?? null,
      club: playerMeta[pid]?.club ?? null,
      locked: lockedPlayerIds.has(pid),
    })),
  );

  // Build other teams' squads (all participants except me)
  const otherTeams = d.users
    .filter((u) => u.id !== d.me!.id)
    .map((u) => {
      const squad = sortByPosition(
        (allTeamRows ?? [])
          .filter((r: { auction_user_id: number }) => r.auction_user_id === u.id)
          .map((r: { player_id: string }) => {
            const pid = String(r.player_id);
            return {
              player_id: pid,
              player_name: playerMeta[pid]?.player_name ?? null,
              position: playerMeta[pid]?.position ?? null,
              club: playerMeta[pid]?.club ?? null,
            };
          }),
      );
      return {
        id: u.id,
        name: u.name,
        budget_remaining: u.budget_remaining,
        active_budget: u.active_budget,
        squad,
      };
    });

  return (
    <ProposeTransferClient
      auctionId={auctionId}
      mySquad={mySquad}
      myBudget={{
        budget_remaining: d.me.budget_remaining,
        active_budget: d.me.active_budget,
      }}
      myName={d.me.name ?? "You"}
      otherTeams={otherTeams}
    />
  );
}
