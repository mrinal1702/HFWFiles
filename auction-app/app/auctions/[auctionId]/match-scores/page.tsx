import { ScoresTabs } from "@/app/scores/_components/ScoresTabs";
import { MATCH_SCORE_GROUPS } from "@/lib/match-scores/sheets";

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

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Match scores</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Same match sheets as the public scores page — inside this auction, player names open
          ownership, points, and bid history for this league.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <ScoresTabs
          groups={MATCH_SCORE_GROUPS}
          initialSlug={match}
          auctionId={auctionId}
        />
      </div>
    </section>
  );
}
