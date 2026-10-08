import { createAdminClient } from "@/lib/supabase-server";
import { loadAuctionDashboardForViewer } from "@/lib/auction-state/auction-dashboard";
import { SquadByPosition } from "@/app/auctions/_components/SquadByPosition";
import { ReleaseButton } from "./_components/ReleaseButton";

export const dynamic = "force-dynamic";

type TeamRow = { player_id: string | number; purchase_price: number };

export default async function MyTeamPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const d = await loadAuctionDashboardForViewer(auctionId);
  const returnTo = `/auctions/${auctionId}/team`;

  if (!d.me) {
    return (
      <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm leading-relaxed text-slate-600">
          Choose your manager in the header to see your roster here.
        </p>
      </section>
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auction_teams")
    .select("player_id, purchase_price")
    .eq("auction_id", auctionId)
    .eq("auction_user_id", d.me.id)
    .order("player_id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const paidReleaseUsed = d.me.paid_release_used;
  const biddingOpen = !d.biddingClosed;
  const isRelegated = Boolean(d.me.is_relegated);

  const byPlayer = new Map(d.lots.map((l) => [l.player_id, l]));
  // Same rule as Bids held: leading bids while bidding is open.
  const bidsHeld = d.biddingClosed
    ? 0
    : d.lots.filter((l) => l.status === "bidding" && l.high_bidder_id === d.me!.id).length;
  const rows = (data ?? []).map((row) => {
    const r = row as TeamRow;
    return {
      player_id: String(r.player_id),
      purchase_price: r.purchase_price,
    };
  });
  const squad = rows.map((row) => {
    const meta = byPlayer.get(row.player_id);
    return {
      player_id: row.player_id,
      player_name: meta?.player_name ?? null,
      club: meta?.club ?? null,
      position: meta?.position ?? null,
      price: row.purchase_price,
    };
  });

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 py-4 pl-5 pr-4 shadow-sm sm:py-5 sm:pl-6 sm:pr-5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200 sm:h-11 sm:w-11"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 15 3a3 3 0 0 1-6 0Z"
                />
              </svg>
            </span>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">My team</h2>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-3">
            <div className="min-w-0 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 px-3 py-1.5 text-white shadow-sm shadow-sky-200 sm:min-w-[9rem]">
              <div className="text-[11px] font-medium uppercase tracking-wide text-sky-100">Players purchased</div>
              <div className="font-mono text-lg font-semibold leading-tight tabular-nums">{rows.length}</div>
            </div>
            <div className="min-w-0 rounded-xl border border-sky-200 bg-white px-3 py-1.5 sm:min-w-[9rem]">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Winning bids held</div>
              <div className="font-mono text-lg font-semibold leading-tight tabular-nums text-slate-900">
                {bidsHeld}
              </div>
            </div>
          </div>
        </div>
        {isRelegated && (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            You were relegated after the standings cut. Your squad has been returned to the player pool and
            you cannot make transfers or place bids.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white/70 p-3 shadow-sm sm:p-5">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-600">No players on your roster yet.</p>
        ) : (
          <SquadByPosition
            players={squad}
            playerHref={(id) => `/auctions/${auctionId}/players/${id}?returnTo=${encodeURIComponent(returnTo)}`}
            renderAction={(p) => (
              <ReleaseButton
                auctionId={auctionId}
                playerId={p.player_id}
                playerName={p.player_name ?? "this player"}
                purchasePrice={p.price ?? 0}
                paidReleaseUsed={paidReleaseUsed}
                biddingOpen={biddingOpen}
                releaseLocked={byPlayer.get(p.player_id)?.nation_bidding_closed ?? false}
                isRelegated={isRelegated}
              />
            )}
          />
        )}
      </div>
    </section>
  );
}
