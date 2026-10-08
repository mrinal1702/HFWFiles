import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar } from "@/app/_components/entity/Avatar";
import { InfoTip } from "@/app/_components/InfoTip";
import { getAuthUser } from "@/lib/auth/get-user";
import { loadCompetitorView } from "@/lib/auction-state/auction-dashboard";
import { RosterSlotCounts } from "@/app/auctions/_components/RosterSlotCounts";
import { LeadingBidsList } from "@/app/auctions/_components/LeadingBidsList";
import { SquadByPosition } from "@/app/auctions/_components/SquadByPosition";
import { fantasyTeamLabel } from "@/lib/team-name";

export const dynamic = "force-dynamic";

export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ auctionId: string; auctionUserId: string }>;
}) {
  const { auctionId: aRaw, auctionUserId: uRaw } = await params;
  const auctionId = Number(aRaw);
  const competitorUserId = Number(uRaw);
  if (!Number.isFinite(competitorUserId)) {
    notFound();
  }

  const user = await getAuthUser();
  const v = await loadCompetitorView(auctionId, competitorUserId, user?.id ?? null);
  if (!v.competitor) {
    notFound();
  }

  const returnTo = `/auctions/${auctionId}/competitors/${competitorUserId}`;
  const competitorLabel = fantasyTeamLabel(v.competitor.team_name, v.competitor.name);
  const playerHref = (id: string) =>
    `/auctions/${auctionId}/players/${id}?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 py-4 pl-5 pr-4 shadow-sm sm:py-5 sm:pl-6 sm:pr-5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        <Link
          href={`/auctions/${auctionId}/competitors`}
          className="inline-flex min-h-10 items-center py-2 text-sm font-medium text-sky-700 hover:text-sky-900"
        >
          ← Competitors – Bidding
        </Link>
        <div className="mt-2 flex items-center gap-3">
          {v.competitor.user_id ? (
            <Link
              href={`/u/${v.competitor.user_id}?returnTo=${encodeURIComponent(returnTo)}`}
              className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
              aria-label={`View ${v.competitor.name ?? "manager"} HFW profile`}
            >
              <Avatar
                name={v.competitor.name ?? `Manager #${competitorUserId}`}
                avatarUrl={v.competitor.avatar_url}
                size="md"
              />
            </Link>
          ) : (
            <Avatar
              name={v.competitor.name ?? `Manager #${competitorUserId}`}
              avatarUrl={v.competitor.avatar_url}
              size="md"
            />
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
              {fantasyTeamLabel(v.competitor.team_name, v.competitor.name)}
            </h2>
            {v.competitor.team_name?.trim() && (
              <p className="text-sm text-slate-600">{v.competitor.name}</p>
            )}
            {v.competitor.is_relegated && (
              <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                Relegated
              </span>
            )}
            {v.competitor.user_id && (
              <Link
                href={`/u/${v.competitor.user_id}?returnTo=${encodeURIComponent(returnTo)}`}
                className="mt-1 inline-block text-sm font-medium text-sky-700 underline hover:text-sky-900"
              >
                View HFW profile
              </Link>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <div className="min-w-0 rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 px-3 py-1.5 text-white shadow-sm shadow-sky-200 sm:min-w-[7rem]">
            <div className="text-[11px] font-medium uppercase tracking-wide text-sky-100">Remaining</div>
            <div className="font-mono text-lg font-semibold leading-tight tabular-nums">
              {v.competitor.budget_remaining}
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-sky-200 bg-white px-3 py-1.5 sm:min-w-[7rem]">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Disposable</div>
            <div className="font-mono text-lg font-semibold leading-tight tabular-nums text-slate-900">
              {v.competitor.active_budget}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <RosterSlotCounts owned={v.sold.length} bidsHeld={v.leading.length} />
        </div>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white/70 p-3 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">View Team</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Players they&apos;ve won in this auction.
        </p>
        {v.sold.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Nobody on their roster yet.</p>
        ) : (
          <div className="mt-4">
            <SquadByPosition
              players={v.sold.map((l) => ({
                player_id: l.player_id,
                player_name: l.player_name,
                club: l.club,
                position: l.position,
                price: l.high_amount,
              }))}
              playerHref={playerHref}
            />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white/70 p-3 shadow-sm sm:p-5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-semibold text-slate-900">Bids Held by {competitorLabel}</h3>
          <InfoTip
            text={`These are bids ${competitorLabel} is winning. Hit refresh to update`}
            label={`About bids held by ${competitorLabel}`}
          />
        </div>
        {v.leading.length > 0 && (
          <div className="mt-3">
            <LeadingBidsList lots={v.leading} playerHref={playerHref} />
          </div>
        )}
      </div>
    </section>
  );
}
