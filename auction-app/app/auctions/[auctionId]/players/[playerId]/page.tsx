import Link from "next/link";
import { notFound } from "next/navigation";

import { ManagerChip } from "@/app/_components/entity/ManagerChip";
import { BidRowForm } from "@/app/auctions/_components/BidRowForm";
import { LocalTime } from "@/app/auctions/_components/LocalTime";
import { getAuthUser } from "@/lib/auth/get-user";
import { getBidDisabledReason, lotRaiseModeActive } from "@/lib/auction-bid-gates";
import { nextMinimumBidAmount } from "@/lib/bid-ui-messages";
import { lotRowAnchorId } from "@/lib/lot-row-anchor";
import { loadPlayerAuctionDetail } from "@/lib/player-auction-detail";

export const dynamic = "force-dynamic";

function lotStatusLabel(
  status: string,
  biddingClosed: boolean,
): string {
  if (biddingClosed && status === "bidding") return "Closed (auction ended)";
  switch (status) {
    case "uninitiated":
      return "Unsold (no bids)";
    case "bidding":
      return "Ongoing bids";
    case "sold":
      return "Sold";
    case "unsold":
      return "Closed (unsold)";
    default:
      return status;
  }
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ auctionId: string; playerId: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { auctionId: aRaw, playerId: pRaw } = await params;
  const auctionId = Number(aRaw);
  const playerId = String(pRaw);
  if (!Number.isFinite(auctionId) || auctionId <= 0) {
    notFound();
  }

  const user = await getAuthUser();
  const detail = await loadPlayerAuctionDetail(auctionId, playerId, user?.id ?? null);
  if (!detail) {
    notFound();
  }

  const { lot, gate, ownership, gwScores, bids, releases } = detail;
  const returnToRaw = searchParams ? (await searchParams).returnTo : undefined;
  const backHref =
    typeof returnToRaw === "string" && returnToRaw.startsWith("/")
      ? returnToRaw
      : `/auctions/${auctionId}/bidding-room`;
  const backToSearchHref = `/auctions/${auctionId}/bidding-room?tab=search`;
  const fromScores =
    typeof returnToRaw === "string" && returnToRaw.includes("/match-scores");

  const displayStatus = lot
    ? lotStatusLabel(lot.status, gate.biddingClosed)
    : "Not in auction pool";

  const highBidDisplay = !lot
    ? "—"
    : lot.status === "sold"
      ? lot.high_amount != null
        ? String(lot.high_amount)
        : "—"
      : lot.status === "uninitiated" || lot.status === "unsold"
        ? "—"
        : lot.high_amount != null
          ? String(lot.high_amount)
          : "—";

  const showTimer =
    lot != null && lot.status === "bidding" && !gate.biddingClosed && lot.expires_at != null;

  const minBid = lot
    ? nextMinimumBidAmount(lot.high_amount, lotRaiseModeActive(lot, gate))
    : 0;
  const disabledReason = lot ? getBidDisabledReason(lot, gate) : "Player is not in this auction pool.";

  const totalPoints = gwScores.reduce((sum, g) => sum + g.score, 0);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-600">Player</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
              {detail.playerName ?? `Player #${playerId}`}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {(detail.club ?? "—") + " · " + (detail.position ?? "—")}
            </p>
          </div>
          <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-slate-800">
            {displayStatus}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <div className="text-xs font-medium text-slate-600">
              {lot?.status === "sold" || ownership ? "Purchase price" : "High bid"}
            </div>
            <div className="mt-1 font-mono text-base font-semibold text-slate-900">
              {ownership ? ownership.purchasePrice : highBidDisplay}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <div className="text-xs font-medium text-slate-600">
              {ownership ? "Owned by" : "High bidder"}
            </div>
            <div className="mt-1 truncate text-sm font-medium text-slate-800">
              {ownership ? (
                <ManagerChip
                  auctionId={auctionId}
                  auctionUserId={ownership.auctionUserId}
                  name={ownership.managerName}
                  teamName={ownership.teamName}
                  avatarUrl={ownership.managerAvatarUrl}
                  labelClassName="font-medium"
                />
              ) : lot?.high_bidder_id != null ? (
                <ManagerChip
                  auctionId={auctionId}
                  auctionUserId={lot.high_bidder_id}
                  name={lot.high_bidder_name}
                  avatarUrl={lot.high_bidder_avatar_url}
                  labelClassName="font-medium"
                />
              ) : (
                "—"
              )}
            </div>
          </div>
          {lot && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm sm:col-span-2">
              <div className="text-xs font-medium text-slate-600">Lot timer</div>
              <div className="mt-1 text-sm text-slate-800">
                {showTimer ? <LocalTime iso={lot.expires_at} /> : "—"}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href={backHref}
              aria-label="Back to previous page"
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-800 shadow-sm hover:bg-sky-50/50"
            >
              ← Back
            </Link>
            {!fromScores && (
              <Link
                href={backToSearchHref}
                aria-label="Back to player search"
                className="min-h-11 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-sm font-medium text-sky-800 shadow-sm hover:bg-sky-100"
              >
                Back to search
              </Link>
            )}
            <Link
              href={`/auctions/${auctionId}/match-scores`}
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 shadow-sm hover:bg-sky-50/50"
            >
              Match scores
            </Link>
          </div>
        </div>

        {lot && (
          <div
            className="mt-5 scroll-mt-28 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
            id={lotRowAnchorId(lot.player_id)}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Place a bid</h3>
              {disabledReason ? (
                <div className="text-xs font-medium text-slate-600">Not available right now</div>
              ) : (
                <div className="text-xs font-medium text-slate-600">Next bid starts at {minBid}</div>
              )}
            </div>
            <div className="mt-3">
              <BidRowForm
                auctionId={auctionId}
                playerId={lot.player_id}
                minBid={minBid}
                disabledReason={disabledReason}
              />
            </div>
          </div>
        )}

        {!lot && (
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            This player is not in the auction lot pool, so there is no bid form. Ownership and
            scores below still reflect this auction when available.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">Points this auction</h3>
        <p className="mt-1 text-sm text-slate-600">
          Gameweek scores from published FinalPoints (same source as the leaderboard).
        </p>
        {gwScores.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No published scores for this player yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[16rem] border-collapse text-left text-sm">
              <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Gameweek</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Points</th>
                </tr>
              </thead>
              <tbody>
                {gwScores.map((g) => (
                  <tr key={g.gameWeekId} className="border-b border-slate-100">
                    <td className="px-3 py-2.5 text-slate-800">{g.gameWeekName}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium tabular-nums text-slate-900">
                      {g.score}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-3 py-2.5 text-slate-900">Total</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900">
                    {totalPoints}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">Bid history</h3>
        <p className="mt-1 text-sm text-slate-600">All bids on this player in this auction.</p>
        {bids.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No bids yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...bids].reverse().map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-100 bg-white px-3 py-2.5 text-sm shadow-sm"
              >
                <ManagerChip
                  auctionId={auctionId}
                  auctionUserId={b.auctionUserId}
                  name={b.managerName}
                  teamName={b.teamName}
                  avatarUrl={b.managerAvatarUrl}
                />
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {b.amount}
                  </span>
                  <span className="text-xs text-slate-500">
                    <LocalTime iso={b.createdAt} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">Ownership &amp; releases</h3>
        <p className="mt-1 text-sm text-slate-600">
          Current owner and any releases recorded for this player in this auction.
        </p>
        {ownership && (
          <p className="mt-3 text-sm text-slate-800">
            Currently owned by{" "}
            <ManagerChip
              auctionId={auctionId}
              auctionUserId={ownership.auctionUserId}
              name={ownership.managerName}
              teamName={ownership.teamName}
              avatarUrl={ownership.managerAvatarUrl}
              className="align-middle"
            />{" "}
            for <span className="font-mono font-semibold">{ownership.purchasePrice}</span>.
          </p>
        )}
        {!ownership && (
          <p className="mt-3 text-sm text-slate-600">Nobody currently owns this player.</p>
        )}
        {releases.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No releases recorded.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {[...releases].reverse().map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-sky-100 bg-white px-3 py-2.5 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ManagerChip
                    auctionId={auctionId}
                    auctionUserId={r.auctionUserId}
                    name={r.managerName}
                    teamName={r.teamName}
                    avatarUrl={r.managerAvatarUrl}
                  />
                  <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    {r.releaseType} release
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-600">
                  Paid <span className="font-mono">{r.purchasePrice}</span>
                  {" · "}
                  Refund <span className="font-mono">{r.refundAmount}</span>
                  {" · "}
                  <LocalTime iso={r.createdAt} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
