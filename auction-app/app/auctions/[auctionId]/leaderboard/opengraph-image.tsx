import { OG_CONTENT_TYPE, OG_SIZE, ogCard, ogDefaultCard, shortGwName } from "@/lib/og/card";
import { loadOgAuctionSummary } from "@/lib/og/auction-summary";
import { getLeaderboardData } from "@/lib/scoring/leaderboard-data";

// Link preview for the leaderboard: current standings (top 5). Read-only.
export const alt = "HFW auction standings";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId: raw } = await params;
  const summary = await loadOgAuctionSummary(Number(raw));
  if (!summary?.publicView) return ogDefaultCard();

  const lb = await getLeaderboardData(summary.id);
  const lastGw = lb.gameWeeks.at(-1) ?? null;

  return ogCard({
    eyebrow: "Standings",
    title: summary.name,
    subtitle: [summary.competitionName, lastGw ? `after ${shortGwName(lastGw.name)}` : null].filter(Boolean).join(" · "),
    rows: lastGw
      ? lb.standings.slice(0, 5).map((s) => ({
          lead: String(s.rank),
          name: s.name,
          sub: s.teamName,
          value: String(s.total),
          highlight: s.rank === 1,
        }))
      : [],
    valueLabel: "Pts",
    note: lastGw ? null : "No gameweeks scored yet. Standings appear after the first gameweek.",
  });
}
