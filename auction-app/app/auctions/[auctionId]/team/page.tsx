import Link from "next/link";

import { createAdminClient } from "@/lib/supabase-server";
import { loadAuctionDashboardForViewer } from "@/lib/auction-state/auction-dashboard";
import { POSITION_THEME, PositionPill } from "@/app/auctions/_components/position-theme";
import { ReleaseButton } from "./_components/ReleaseButton";

export const dynamic = "force-dynamic";

type TeamRow = { player_id: string | number; purchase_price: number };
type SectionId = "gk" | "def" | "mid" | "fwd" | "other";

const SECTION_ORDER: Array<{ id: SectionId; label: string }> = [
  { id: "gk", label: "Goalkeepers" },
  { id: "def", label: "Defenders" },
  { id: "mid", label: "Midfielders" },
  { id: "fwd", label: "Forwards" },
  { id: "other", label: "Other" },
];

const SECTION_THEME: Record<SectionId, (typeof POSITION_THEME)[number]> = {
  gk: POSITION_THEME[0],
  def: POSITION_THEME[1],
  mid: POSITION_THEME[2],
  fwd: POSITION_THEME[3],
  other: POSITION_THEME[4],
};

function sectionForPosition(position: string | null | undefined): SectionId {
  const p = (position ?? "").trim().toLowerCase();
  if (p === "gk" || p.includes("goalkeeper")) return "gk";
  if (p.includes("defend")) return "def";
  if (p.includes("midfield")) return "mid";
  if (p.includes("forward")) return "fwd";
  return "other";
}

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
  const enrichedRows = rows.map((row) => {
    const meta = byPlayer.get(String(row.player_id));
    return {
      ...row,
      meta,
      section: sectionForPosition(meta?.position),
    };
  });
  const grouped = SECTION_ORDER.map((section) => {
    const sectionRows = enrichedRows
      .filter((r) => r.section === section.id)
      .sort((a, b) => {
        const clubA = (a.meta?.club ?? "").toLowerCase();
        const clubB = (b.meta?.club ?? "").toLowerCase();
        if (clubA !== clubB) return clubA.localeCompare(clubB);
        const nameA = (a.meta?.player_name ?? "").toLowerCase();
        const nameB = (b.meta?.player_name ?? "").toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.player_id.localeCompare(b.player_id);
      });
    return {
      ...section,
      rows: sectionRows,
    };
  }).filter((s) => s.rows.length > 0);

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
          <>
            <div className="space-y-4 md:hidden">
              {grouped.map((group) => (
                <div key={group.id}>
                  <h3
                    className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${SECTION_THEME[group.id].heading}`}
                  >
                    {group.label} ({group.rows.length})
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {group.rows.map((t) => (
                      <li
                        key={`${group.id}-${t.player_id}`}
                        className={`relative overflow-hidden rounded-xl border py-3 pl-4 pr-3 shadow-sm ${SECTION_THEME[group.id].card}`}
                      >
                        <span
                          aria-hidden
                          className={`absolute inset-y-0 left-0 w-1.5 ${SECTION_THEME[group.id].stripe}`}
                        />
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="text-base font-semibold text-slate-900">
                            <Link
                              href={`/auctions/${auctionId}/players/${t.player_id}?returnTo=${encodeURIComponent(
                                returnTo,
                              )}`}
                              className="hover:underline"
                            >
                              {t.meta?.player_name ?? "—"}
                            </Link>
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-semibold tabular-nums text-slate-900">
                              {t.purchase_price}
                            </span>
                            <ReleaseButton
                              auctionId={auctionId}
                              playerId={t.player_id}
                              playerName={t.meta?.player_name ?? "this player"}
                              purchasePrice={t.purchase_price}
                              paidReleaseUsed={paidReleaseUsed}
                              biddingOpen={biddingOpen}
                              releaseLocked={t.meta?.nation_bidding_closed ?? false}
                              isRelegated={isRelegated}
                            />
                          </div>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                          <span>{t.meta?.club ?? "—"}</span>
                          <PositionPill position={t.meta?.position} />
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[28rem] border-separate border-spacing-y-1.5 text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Player</th>
                    <th className="px-3 py-2 font-semibold">Club</th>
                    <th className="px-3 py-2 font-semibold">Pos</th>
                    <th className="px-3 py-2 font-semibold">Price</th>
                    <th className="px-3 py-2 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.flatMap((group, groupIdx) => {
                    const rowsForGroup = group.rows.map((t) => (
                      <tr
                        key={`${group.id}-${t.player_id}`}
                        className={`[&>td]:border-y [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l-[6px] [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r ${SECTION_THEME[group.id].row}`}
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          <Link
                            href={`/auctions/${auctionId}/players/${t.player_id}?returnTo=${encodeURIComponent(
                              returnTo,
                            )}`}
                            className="hover:underline"
                          >
                            {t.meta?.player_name ?? "—"}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{t.meta?.club ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          <PositionPill position={t.meta?.position} />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-base font-semibold tabular-nums text-slate-900">
                          {t.purchase_price}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <ReleaseButton
                            auctionId={auctionId}
                            playerId={t.player_id}
                            playerName={t.meta?.player_name ?? "this player"}
                            purchasePrice={t.purchase_price}
                            paidReleaseUsed={paidReleaseUsed}
                            biddingOpen={biddingOpen}
                            releaseLocked={t.meta?.nation_bidding_closed ?? false}
                            isRelegated={isRelegated}
                          />
                        </td>
                      </tr>
                    ));
                    return [
                      <tr key={`${group.id}-header`}>
                        <td colSpan={5} className={`px-1 pb-0.5 ${groupIdx === 0 ? "pt-0" : "pt-3"}`}>
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${SECTION_THEME[group.id].heading}`}
                          >
                            {group.label} ({group.rows.length})
                          </span>
                        </td>
                      </tr>,
                      ...rowsForGroup,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
