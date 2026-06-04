import { redirect } from "next/navigation";

export default async function LeaderboardRedirect({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  redirect(`/leaderboard/${auctionId}`);
}
