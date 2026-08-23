import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** My Points moved to Leaderboard → My Points tab. */
export default async function PointsPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  redirect(`/leaderboard/${auctionId}?tab=my-points`);
}
