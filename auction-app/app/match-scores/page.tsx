import { ScoresTabs } from "@/app/scores/_components/ScoresTabs";
import { MATCH_SCORE_GROUPS } from "@/lib/match-scores/sheets";

export default async function MatchScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ match?: string }>;
}) {
  const { match } = await searchParams;

  return <ScoresTabs groups={MATCH_SCORE_GROUPS} initialSlug={match} />;
}
