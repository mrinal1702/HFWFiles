import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy URL — leaderboard now lives under auction chrome with the side menu. */
export default async function LeaderboardRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ auctionId: string }>;
  searchParams: Promise<{ tab?: string; gw?: string }>;
}) {
  const { auctionId } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.tab) qs.set("tab", sp.tab);
  if (sp.gw) qs.set("gw", sp.gw);
  const q = qs.toString();
  redirect(`/auctions/${auctionId}/leaderboard${q ? `?${q}` : ""}`);
}
