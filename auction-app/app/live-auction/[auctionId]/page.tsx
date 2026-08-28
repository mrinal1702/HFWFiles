import { getAuthUser } from "@/lib/auth/get-user";
import { userHasLiveAuctionAdminAccess } from "@/lib/live-auction-auth";
import {
  getLiveAuction,
  getParticipantSummariesWithPositions,
  getParticipantSquad,
  getUnsoldPlayers,
  getParticipantByUserId,
  getAllSalesPublic,
} from "@/lib/live-auction-data";
import { AuctionTabs } from "./_components/AuctionTabs";

export const dynamic = "force-dynamic";

export default async function LiveAuctionOverviewPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  const user = await getAuthUser();

  const auction = await getLiveAuction(auctionId);
  if (!auction) return null; // layout handles 404

  const myParticipant = user ? await getParticipantByUserId(auctionId, user.id) : null;
  const isAdmin = user ? await userHasLiveAuctionAdminAccess(auctionId, user.id) : false;

  const [summaries, mySquad, unsoldPlayers, allSales] = await Promise.all([
    getParticipantSummariesWithPositions(auctionId, auction.starting_budget),
    myParticipant
      ? getParticipantSquad(auctionId, myParticipant.id)
      : Promise.resolve([]),
    getUnsoldPlayers(auctionId),
    getAllSalesPublic(auctionId),
  ]);

  return (
    <AuctionTabs
      auction={auction}
      auctionId={auctionId}
      myParticipant={myParticipant}
      mySquad={mySquad}
      summaries={summaries}
      unsoldPlayers={unsoldPlayers}
      isAdmin={isAdmin}
      allSales={allSales}
    />
  );
}
