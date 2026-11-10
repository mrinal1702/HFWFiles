import { OG_CONTENT_TYPE, OG_SIZE, ogCard, ogDefaultCard, type OgRow } from "@/lib/og/card";
import { loadOgAuctionSummary } from "@/lib/og/auction-summary";
import { getLeaderboardData } from "@/lib/scoring/leaderboard-data";

// Link preview for every in-auction page (overridden by the leaderboard's own card).
// Read-only; shows auction data only when a logged-out visitor could open the auction.
export const alt = "HFW auction";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId: raw } = await params;
  const summary = await loadOgAuctionSummary(Number(raw));
  if (!summary?.publicView) return ogDefaultCard();

  const lb = await getLeaderboardData(summary.id);
  const top: OgRow[] = lb.gameWeeks.length
    ? lb.standings.slice(0, 3).map((s) => ({
        lead: String(s.rank),
        name: s.name,
        sub: s.teamName,
        value: String(s.total),
        highlight: s.rank === 1,
      }))
    : [];

  return ogCard({
    eyebrow: "Auction",
    title: summary.name,
    subtitle: [summary.competitionName, `${summary.managerCount} managers`].filter(Boolean).join(" · "),
    rows: top,
    valueLabel: top.length ? "Pts" : undefined,
    note: top.length ? null : "Bidding is under way. Follow every bid, squad and budget on HFW.",
  });
}
