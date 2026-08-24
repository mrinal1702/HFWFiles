import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Competitors list moved to Leaderboard → Competitors tab. */
export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  redirect(`/auctions/${auctionId}/leaderboard?tab=competitors`);
}
