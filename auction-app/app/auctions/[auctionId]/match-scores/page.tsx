import { ScoresTabs } from "@/app/scores/_components/ScoresTabs";
import { getMatchScoreGroupsForCompetitionId } from "@/lib/scoring/match-scores/sheets";
import { createAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function AuctionMatchScoresPage({
  params,
  searchParams,
}: {
  params: Promise<{ auctionId: string }>;
  searchParams: Promise<{ match?: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const { match } = await searchParams;

  const admin = createAdminClient();
  const { data: auctionRow } = await admin
    .from("Auctions")
    .select("competition_id")
    .eq("id", auctionId)
    .maybeSingle();

  const groups = getMatchScoreGroupsForCompetitionId(
    auctionRow?.competition_id != null ? Number(auctionRow.competition_id) : null,
  );

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 py-3 pl-5 pr-3 shadow-sm sm:gap-4 sm:py-4 sm:pl-6 sm:pr-5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200 sm:h-11 sm:w-11"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.5 3.5 2.5-1.3 4h-4.4l-1.3-4L12 7.5Zm0 0V3.5m3.5 6.5 4-1.5m-5.3 5.5 2.3 3.5m-6.7-3.5-2.3 3.5M8.5 10l-4-1.5"
            />
          </svg>
        </span>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl uppercase tracking-wide">Match scores</h2>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white/70 p-3 shadow-sm sm:p-5">
        <ScoresTabs
          groups={groups}
          initialSlug={match}
          auctionId={auctionId}
        />
      </div>
    </section>
  );
}
