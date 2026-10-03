import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AuctionAdminIndexPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  redirect(`/auction-admin/${auctionId}/players`);
}
