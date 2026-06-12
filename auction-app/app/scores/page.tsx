import { ScoresTabs } from "@/app/scores/_components/ScoresTabs";
import { MATCH_SCORE_SHEETS } from "@/lib/match-scores/sheets";

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ match?: string }>;
}) {
  const { match } = await searchParams;

  return <ScoresTabs sheets={MATCH_SCORE_SHEETS} initialSlug={match} />;
}
