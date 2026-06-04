import { notFound } from "next/navigation";

import { ProposeTransferClient } from "@/app/auctions/[auctionId]/transfers/new/_components/ProposeTransferClient";
import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function NewTransferPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);

  const d = await loadAuctionDashboardForViewer(auctionId);

  if (!d.me) notFound();

  // Block if past hard deadline
  const pastHard = d.auction?.hard_deadline_at
    ? Date.now() >= Date.parse(d.auction.hard_deadline_at)
    : false;

  if (pastHard) {
    return (
      <section className="rounded-xl border border-amber-100 bg-amber-50 p-4 sm:p-5">
        <p className="font-medium text-amber-900">Transfer deadline has passed</p>
        <p className="mt-1 text-sm text-amber-800">No new transfers can be proposed.</p>
      </section>
    );
  }

  const admin = createAdminClient();

  // Load my squad
  const { data: teamRows, error: teamErr } = await admin
    .from("auction_teams")
    .select("player_id")
    .eq("auction_id", auctionId)
    .eq("auction_user_id", d.me.id);

  if (teamErr) throw new Error(teamErr.message);

  const myPlayerIds = (teamRows ?? []).map((r: { player_id: string }) => String(r.player_id));

  // Load player metadata
  const playerMeta: Record<string, { player_name: string | null; position: string | null; club: string | null }> = {};
  if (myPlayerIds.length > 0) {
    const { data: playerRows, error: playerErr } = await admin
      .from("players")
      .select("player_id, player_name, position, team_name")
      .in("player_id", myPlayerIds);
    if (playerErr) throw new Error(playerErr.message);
    for (const p of playerRows ?? []) {
      const row = p as { player_id: string; player_name: string | null; position: string | null; team_name: string | null };
      playerMeta[String(row.player_id)] = {
        player_name: row.player_name,
        position: row.position,
        club: row.team_name,
      };
    }
  }

  // Find which players are locked in active transfers
  const { data: activeTransfers } = await admin
    .from("auction_transfers")
    .select("proposer_player_ids")
    .eq("auction_id", auctionId)
    .not("status", "in", '("completed","rejected","cancelled")')
    .eq("proposer_id", d.me.id);

  const lockedPlayerIds = new Set<string>(
    (activeTransfers ?? []).flatMap(
      (t: { proposer_player_ids: string[] }) => t.proposer_player_ids,
    ),
  );

  const mySquad = myPlayerIds.map((pid) => ({
    player_id: pid,
    player_name: playerMeta[pid]?.player_name ?? null,
    position: playerMeta[pid]?.position ?? null,
    club: playerMeta[pid]?.club ?? null,
    locked: lockedPlayerIds.has(pid),
  }));

  // Sort by position then name
  const posOrder: Record<string, number> = { gk: 0, goalkeeper: 0, defender: 1, midfielder: 2, forward: 3 };
  mySquad.sort((a, b) => {
    const pa = posOrder[a.position?.toLowerCase() ?? ""] ?? 4;
    const pb = posOrder[b.position?.toLowerCase() ?? ""] ?? 4;
    if (pa !== pb) return pa - pb;
    return (a.player_name ?? "").localeCompare(b.player_name ?? "");
  });

  // Other teams in this auction (excluding me)
  const otherTeams = d.users
    .filter((u) => u.id !== d.me!.id)
    .map((u) => ({ id: u.id, name: u.name }));

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900">Propose a transfer</h2>
        <p className="mt-1 text-sm text-slate-600">
          Select which manager you&apos;re dealing with, choose your players and cash to offer.
          The other manager will then fill in their side of the deal, and both parties confirm
          before it executes.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <ProposeTransferClient
          auctionId={auctionId}
          mySquad={mySquad}
          otherTeams={otherTeams}
        />
      </div>
    </section>
  );
}
