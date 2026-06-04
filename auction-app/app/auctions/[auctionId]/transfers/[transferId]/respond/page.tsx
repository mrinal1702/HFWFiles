import { notFound } from "next/navigation";

import { RespondTransferClient } from "@/app/auctions/[auctionId]/transfers/[transferId]/respond/_components/RespondTransferClient";
import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";
import { createAdminClient } from "@/lib/supabase-server";
import type { AuctionTransfer } from "@/lib/transfers";

export const dynamic = "force-dynamic";

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

  // Only the recipient can respond, and only in awaiting_response
  if (transfer.recipient_id !== d.me.id || transfer.status !== "awaiting_response") {
    return (
      <section className="rounded-xl border border-amber-100 bg-amber-50 p-4 sm:p-5">
        <p className="font-medium text-amber-900">Cannot respond to this transfer</p>
        <p className="mt-1 text-sm text-amber-800">
          This transfer is either not awaiting a response or you are not the recipient.
        </p>
      </section>
    );
  }

  // Load proposer name and their players
  const proposerUser = d.users.find((u) => u.id === transfer.proposer_id);

  const proposerPlayerNames: Record<string, string | null> = {};
  if (transfer.proposer_player_ids.length > 0) {
    const { data: pp } = await admin
      .from("players")
      .select("player_id, player_name")
      .in("player_id", transfer.proposer_player_ids);
    for (const p of pp ?? []) {
      const row = p as { player_id: string; player_name: string | null };
      proposerPlayerNames[String(row.player_id)] = row.player_name;
    }
  }

  // Load my squad
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

  // Find locked players (already in another active transfer)
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

  const mySquad = myPlayerIds.map((pid) => ({
    player_id: pid,
    player_name: playerMeta[pid]?.player_name ?? null,
    position: playerMeta[pid]?.position ?? null,
    club: playerMeta[pid]?.club ?? null,
    locked: lockedPlayerIds.has(pid),
  }));

  const posOrder: Record<string, number> = { gk: 0, goalkeeper: 0, defender: 1, midfielder: 2, forward: 3 };
  mySquad.sort((a, b) => {
    const pa = posOrder[a.position?.toLowerCase() ?? ""] ?? 4;
    const pb = posOrder[b.position?.toLowerCase() ?? ""] ?? 4;
    if (pa !== pb) return pa - pb;
    return (a.player_name ?? "").localeCompare(b.player_name ?? "");
  });

  return (
    <section className="space-y-4 sm:space-y-5">
      {/* Proposer's offer */}
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900">Respond to transfer proposal</h2>
        <p className="mt-1 text-sm text-slate-600">
          <span className="font-medium text-slate-800">{proposerUser?.name ?? "A manager"}</span>{" "}
          has proposed this deal. Review what they&apos;re offering, then fill in your side.
        </p>

        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {proposerUser?.name ?? "Their"} offer to you
          </p>
          <ul className="mt-2 space-y-1">
            {transfer.proposer_player_ids.map((pid) => (
              <li key={pid} className="text-sm font-medium text-slate-900">
                {proposerPlayerNames[pid] ?? pid}
              </li>
            ))}
            {transfer.proposer_cash > 0 && (
              <li className="text-sm font-medium text-slate-900">£{transfer.proposer_cash}m cash</li>
            )}
            {transfer.proposer_player_ids.length === 0 && transfer.proposer_cash === 0 && (
              <li className="text-sm italic text-slate-400">Nothing specified</li>
            )}
          </ul>
        </div>
      </div>

      {/* My side of the deal */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">Your offer in return</h3>
        <p className="mt-1 text-sm text-slate-600">
          Select your players and/or cash to send back. Once you submit, both parties will need
          to confirm before the transfer executes.
        </p>
        <div className="mt-4">
          <RespondTransferClient
            auctionId={auctionId}
            transferId={transferId}
            mySquad={mySquad}
          />
        </div>
      </div>
    </section>
  );
}
