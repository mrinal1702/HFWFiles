import { OG_CONTENT_TYPE, OG_SIZE, ogCard, ogDefaultCard } from "@/lib/og/card";
import { loadOgAuctionSummary } from "@/lib/og/auction-summary";
import { loadOgSquad } from "@/lib/og/manager-cards";

// Link preview for a manager's current squad (Competitors – Bidding page; "My team" shares this).
// Read-only; auction data only when a logged-out visitor could view the auction.
export const alt = "HFW squad";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamic = "force-dynamic";

export default async function Image({
  params,
}: {
  params: Promise<{ auctionId: string; auctionUserId: string }>;
}) {
  const { auctionId, auctionUserId } = await params;
  const auction = await loadOgAuctionSummary(Number(auctionId));
  if (!auction?.publicView) return ogDefaultCard();
  const squad = await loadOgSquad(auction, Number(auctionUserId));
  if (!squad) return ogDefaultCard();

  return ogCard({
    eyebrow: "Squad",
    title: squad.label,
    subtitle: [
      squad.label !== squad.managerName ? squad.managerName : null,
      auction.name,
      `${squad.playerCount} player${squad.playerCount === 1 ? "" : "s"}`,
      `£${squad.budgetRemaining}m left`,
    ]
      .filter(Boolean)
      .join(" · "),
    rows: squad.top.map((p) => ({
      name: p.name,
      sub: [p.position, p.club].filter(Boolean).join(" · "),
      value: `£${p.price}m`,
    })),
    valueLabel: "Top signings",
    note: "No players signed yet.",
  });
}
