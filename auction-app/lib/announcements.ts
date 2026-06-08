import "server-only";

import { createAdminClient } from "@/lib/supabase-server";
import type { PlayerMeta } from "@/lib/transfers";

/** Rolling lot window length — matches place_bid (24h from winning bid, capped at hard deadline). */
const SALE_WINDOW_MS = 24 * 60 * 60 * 1000;
const EPOCH_ISO = new Date(0).toISOString();

export type BuyAnnouncement = {
  type: "buy";
  timestamp: string;
  playerId: string;
  playerName: string | null;
  playerPosition: string | null;
  buyerName: string | null;
  price: number;
};

export type ReleaseAnnouncement = {
  type: "release";
  timestamp: string;
  playerId: string;
  playerName: string | null;
  playerPosition: string | null;
  ownerName: string | null;
  releaseType: "paid" | "free";
  purchasePrice: number;
  refundAmount: number;
};

export type TransferAnnouncement = {
  type: "transfer";
  timestamp: string;
  summary: string | null;
  proposerName: string | null;
  recipientName: string | null;
  proposerPlayers: PlayerMeta[];
  recipientPlayers: PlayerMeta[];
  proposerCash: number;
  recipientCash: number;
};

export type Announcement = BuyAnnouncement | ReleaseAnnouncement | TransferAnnouncement;
export type AnnouncementFilter = "all" | "buy" | "release" | "transfer";

type BidRow = {
  player_id: string;
  auction_user_id: number;
  amount: number;
  created_at: string;
};

/** Sale time = when the lot timer expires (winning bid + 24h), capped at the auction hard deadline. */
export function computeSaleTimestamp(
  winningBidCreatedAt: string,
  hardDeadlineAt: string | null,
): string {
  const bidMs = new Date(winningBidCreatedAt).getTime();
  if (Number.isNaN(bidMs)) return EPOCH_ISO;

  let saleMs = bidMs + SALE_WINDOW_MS;
  if (hardDeadlineAt) {
    const hardMs = new Date(hardDeadlineAt).getTime();
    if (!Number.isNaN(hardMs)) {
      saleMs = Math.min(saleMs, hardMs);
    }
  }
  return new Date(saleMs).toISOString();
}

function buildBuyAnnouncements(
  bidsByPlayer: Map<string, BidRow[]>,
  releasesByPlayer: Map<string, { created_at: string }[]>,
  playersInTeams: Set<string>,
  teamsWithoutBids: { player_id: unknown; auction_user_id: number; purchase_price: number }[],
  hardDeadlineAt: string | null,
  playerById: Map<string, { player_name: string | null; position: string | null }>,
  userById: Map<number, string | null>,
): BuyAnnouncement[] {
  const buys: BuyAnnouncement[] = [];

  for (const [playerId, bids] of bidsByPlayer) {
    if (bids.length === 0) continue;

    const releases = (releasesByPlayer.get(playerId) ?? [])
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let cursor = 0;

    for (const release of releases) {
      const releaseMs = new Date(release.created_at).getTime();
      const segmentBids: BidRow[] = [];
      while (cursor < bids.length) {
        const bidMs = new Date(bids[cursor].created_at).getTime();
        if (bidMs >= releaseMs) break;
        segmentBids.push(bids[cursor]);
        cursor++;
      }
      if (segmentBids.length > 0) {
        const winning = segmentBids[segmentBids.length - 1];
        const player = playerById.get(playerId);
        buys.push({
          type: "buy",
          timestamp: computeSaleTimestamp(winning.created_at, hardDeadlineAt),
          playerId,
          playerName: player?.player_name ?? null,
          playerPosition: player?.position ?? null,
          buyerName: userById.get(winning.auction_user_id) ?? null,
          price: winning.amount,
        });
      }
    }

    const remaining = bids.slice(cursor);
    if (remaining.length > 0 && playersInTeams.has(playerId)) {
      const winning = remaining[remaining.length - 1];
      const player = playerById.get(playerId);
      buys.push({
        type: "buy",
        timestamp: computeSaleTimestamp(winning.created_at, hardDeadlineAt),
        playerId,
        playerName: player?.player_name ?? null,
        playerPosition: player?.position ?? null,
        buyerName: userById.get(winning.auction_user_id) ?? null,
        price: winning.amount,
      });
    }
  }

  const playersWithBuys = new Set(buys.map((b) => b.playerId));
  for (const team of teamsWithoutBids) {
    const pid = String(team.player_id);
    if (playersWithBuys.has(pid)) continue;
    const player = playerById.get(pid);
    buys.push({
      type: "buy",
      timestamp: EPOCH_ISO,
      playerId: pid,
      playerName: player?.player_name ?? null,
      playerPosition: player?.position ?? null,
      buyerName: userById.get(team.auction_user_id) ?? null,
      price: team.purchase_price,
    });
  }

  return buys;
}

export async function loadAnnouncements(auctionId: number): Promise<Announcement[]> {
  const supabase = createAdminClient();

  const [auctionRes, teamsRes, releasesRes, transfersRes, bidsRes] = await Promise.all([
    supabase.from("Auctions").select("hard_deadline_at").eq("id", auctionId).maybeSingle(),
    supabase
      .from("auction_teams")
      .select("player_id, auction_user_id, purchase_price")
      .eq("auction_id", auctionId),
    supabase
      .from("auction_releases")
      .select("player_id, auction_user_id, release_type, purchase_price, refund_amount, created_at")
      .eq("auction_id", auctionId),
    supabase
      .from("auction_transfers")
      .select("*")
      .eq("auction_id", auctionId)
      .eq("status", "completed"),
    supabase
      .from("auction_bids")
      .select("player_id, auction_user_id, amount, created_at")
      .eq("auction_id", auctionId)
      .order("created_at", { ascending: true }),
  ]);

  if (auctionRes.error) throw new Error(`Auctions: ${auctionRes.error.message}`);
  if (teamsRes.error) throw new Error(`auction_teams: ${teamsRes.error.message}`);
  if (releasesRes.error) throw new Error(`auction_releases: ${releasesRes.error.message}`);
  if (transfersRes.error) throw new Error(`auction_transfers: ${transfersRes.error.message}`);
  if (bidsRes.error) throw new Error(`auction_bids: ${bidsRes.error.message}`);

  const hardDeadlineAt = (auctionRes.data?.hard_deadline_at as string | null) ?? null;
  const teams = teamsRes.data ?? [];
  const releases = releasesRes.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transfers = (transfersRes.data ?? []) as any[];

  const playersInTeams = new Set(teams.map((t) => String(t.player_id)));

  const bidsByPlayer = new Map<string, BidRow[]>();
  for (const bid of bidsRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = bid as any;
    const pid = String(row.player_id);
    const list = bidsByPlayer.get(pid) ?? [];
    list.push({
      player_id: pid,
      auction_user_id: row.auction_user_id as number,
      amount: row.amount as number,
      created_at: row.created_at as string,
    });
    bidsByPlayer.set(pid, list);
  }

  const releasesByPlayer = new Map<string, { created_at: string }[]>();
  for (const release of releases) {
    const pid = String(release.player_id);
    const list = releasesByPlayer.get(pid) ?? [];
    list.push({ created_at: release.created_at as string });
    releasesByPlayer.set(pid, list);
  }

  const allPlayerIds = [
    ...new Set([
      ...playersInTeams,
      ...releases.map((r) => String(r.player_id)),
      ...transfers.flatMap((t) => [
        ...(t.proposer_player_ids ?? []).map(String),
        ...(t.recipient_player_ids ?? []).map(String),
      ]),
      ...bidsByPlayer.keys(),
    ]),
  ].filter(Boolean);

  const allUserIds = [
    ...new Set([
      ...teams.map((t) => t.auction_user_id as number),
      ...releases.map((r) => r.auction_user_id as number),
      ...transfers.flatMap((t) => [t.proposer_id as number, t.recipient_id as number]),
      ...[...bidsByPlayer.values()].flatMap((bids) => bids.map((b) => b.auction_user_id)),
    ]),
  ].filter((id): id is number => typeof id === "number");

  const [playersRes, usersRes] = await Promise.all([
    allPlayerIds.length
      ? supabase
          .from("players")
          .select("player_id, player_name, position")
          .in("player_id", allPlayerIds)
      : Promise.resolve({ data: [] as { player_id: unknown; player_name: string | null; position: string | null }[], error: null }),
    allUserIds.length
      ? supabase.from("auction_users").select("id, name").in("id", allUserIds)
      : Promise.resolve({ data: [] as { id: number; name: string | null }[], error: null }),
  ]);

  if (playersRes.error) throw new Error(`players: ${(playersRes.error as { message: string }).message}`);
  if (usersRes.error) throw new Error(`auction_users: ${(usersRes.error as { message: string }).message}`);

  const playerById = new Map<string, { player_name: string | null; position: string | null }>();
  for (const p of playersRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = p as any;
    playerById.set(String(row.player_id), {
      player_name: row.player_name,
      position: row.position,
    });
  }

  const userById = new Map<number, string | null>();
  for (const u of usersRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = u as any;
    userById.set(row.id, row.name);
  }

  const teamsWithoutBids = teams.filter((t) => !bidsByPlayer.has(String(t.player_id)));

  const announcements: Announcement[] = [
    ...buildBuyAnnouncements(
      bidsByPlayer,
      releasesByPlayer,
      playersInTeams,
      teamsWithoutBids,
      hardDeadlineAt,
      playerById,
      userById,
    ),
  ];

  for (const release of releases) {
    const pid = String(release.player_id);
    const player = playerById.get(pid);
    announcements.push({
      type: "release",
      timestamp: release.created_at as string,
      playerId: pid,
      playerName: player?.player_name ?? null,
      playerPosition: player?.position ?? null,
      ownerName: userById.get(release.auction_user_id as number) ?? null,
      releaseType: release.release_type as "paid" | "free",
      purchasePrice: release.purchase_price as number,
      refundAmount: release.refund_amount as number,
    });
  }

  for (const t of transfers) {
    const proposerPlayers: PlayerMeta[] = (t.proposer_player_ids ?? []).map((id: string) => ({
      player_id: id,
      player_name: playerById.get(id)?.player_name ?? null,
      position: playerById.get(id)?.position ?? null,
    }));
    const recipientPlayers: PlayerMeta[] = (t.recipient_player_ids ?? []).map((id: string) => ({
      player_id: id,
      player_name: playerById.get(id)?.player_name ?? null,
      position: playerById.get(id)?.position ?? null,
    }));
    const completedAt = t.completed_at as string | null;
    announcements.push({
      type: "transfer",
      timestamp: completedAt ?? (t.created_at as string),
      summary: t.summary ?? null,
      proposerName: userById.get(t.proposer_id) ?? null,
      recipientName: userById.get(t.recipient_id) ?? null,
      proposerPlayers,
      recipientPlayers,
      proposerCash: t.proposer_cash ?? 0,
      recipientCash: t.recipient_cash ?? 0,
    });
  }

  announcements.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return announcements;
}
