import { redirect } from "next/navigation";

export default async function AuctionHubPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  redirect(`/auctions/${auctionId}/bidding-room`);
}
