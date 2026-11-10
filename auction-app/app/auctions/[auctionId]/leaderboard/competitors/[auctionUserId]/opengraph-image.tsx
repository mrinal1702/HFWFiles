import { OG_CONTENT_TYPE, OG_SIZE, ogCard, ogDefaultCard, shortGwName } from "@/lib/og/card";
import { loadOgAuctionSummary } from "@/lib/og/auction-summary";
import { loadOgPoints } from "@/lib/og/manager-cards";

// Link preview for a manager's points page ("My Points" shares this): latest scored gameweek,
// top Best XI scorers, season total and rank. Read-only.
// (Preview images can't see ?gw=, so the card always shows the latest scored gameweek.)
export const alt = "HFW gameweek points";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamic = "force-dynamic";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ auctionId: string; auctionUserId: string }>;
}) {
  const { auctionId, auctionUserId } = await params;
  const auction = await loadOgAuctionSummary(Number(auctionId));
  if (!auction?.publicView) return ogDefaultCard();
  const pts = await loadOgPoints(auction, Number(auctionUserId));
  if (!pts) return ogDefaultCard();

  const gw = pts.gwName ? shortGwName(pts.gwName) : null;
  return ogCard({
    eyebrow: gw ? `${gw} points` : "Points",
    title: pts.label,
    subtitle: [
      gw && pts.gwTotal != null ? `${pts.gwTotal} pts in ${gw}` : null,
      pts.seasonTotal != null ? `Season ${pts.seasonTotal}` : null,
      pts.seasonRank != null ? `${ordinal(pts.seasonRank)} in ${auction.name}` : auction.name,
    ]
      .filter(Boolean)
      .join(" · "),
    rows: pts.top.map((p) => ({ name: p.name, sub: p.club, value: String(p.score) })),
    valueLabel: "Top scorers",
    note: "No points scored yet.",
  });
}
