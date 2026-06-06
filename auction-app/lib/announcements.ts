import "server-only";

import { createAdminClient } from "@/lib/supabase-server";
import type { PlayerMeta } from "@/lib/transfers";

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

export async function loadAnnouncements(auctionId: number): Promise<Announcement[]> {
  const supabase = createAdminClient();

  const [teamsRes, releasesRes, transfersRes] = await Promise.all([
    supabase
      .from("auction_teams")
      .select("player_id, auction_user_id, purchase_price")
      .eq("auction_id", auctionId),
    supabase
      .from("auction_releases")
      .select("player_id, auction_user_id, release_type, purchase_price, refund_amount, created_at")
      .eq("auction_id", auctionId)
      .order("created_at", { ascending: false }),
    supabase
      .from("auction_transfers")
      .select("*")
      .eq("auction_id", auctionId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false }),
  ]);

  if (teamsRes.error) throw new Error(`auction_teams: ${teamsRes.error.message}`);
  if (releasesRes.error) throw new Error(`auction_releases: ${releasesRes.error.message}`);
  if (transfersRes.error) throw new Error(`auction_transfers: ${transfersRes.error.message}`);

  const teams = teamsRes.data ?? [];
  const releases = releasesRes.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transfers = (transfersRes.data ?? []) as any[];

  const buyPlayerIds = teams.map((t) => String(t.player_id));

  const allPlayerIds = [
    ...new Set([
      ...buyPlayerIds,
      ...releases.map((r) => String(r.player_id)),
      ...transfers.flatMap((t) => [
        ...(t.proposer_player_ids ?? []).map(String),
        ...(t.recipient_player_ids ?? []).map(String),
      ]),
    ]),
  ].filter(Boolean);

  const allUserIds = [
    ...new Set([
      ...teams.map((t) => t.auction_user_id as number),
      ...releases.map((r) => r.auction_user_id as number),
      ...transfers.flatMap((t) => [t.proposer_id as number, t.recipient_id as number]),
    ]),
  ].filter((id): id is number => typeof id === "number");

  const [playersRes, usersRes, lastBidsRes] = await Promise.all([
    allPlayerIds.length
      ? supabase
          .from("players")
          .select("player_id, player_name, position")
          .in("player_id", allPlayerIds)
      : Promise.resolve({ data: [] as { player_id: unknown; player_name: string | null; position: string | null }[], error: null }),
    allUserIds.length
      ? supabase.from("auction_users").select("id, name").in("id", allUserIds)
      : Promise.resolve({ data: [] as { id: number; name: string | null }[], error: null }),
    buyPlayerIds.length
      ? supabase
          .from("auction_bids")
          .select("player_id, created_at")
          .eq("auction_id", auctionId)
          .in("player_id", buyPlayerIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { player_id: unknown; created_at: string }[], error: null }),
  ]);

  if (playersRes.error) throw new Error(`players: ${(playersRes.error as { message: string }).message}`);
  if (usersRes.error) throw new Error(`auction_users: ${(usersRes.error as { message: string }).message}`);
  if (lastBidsRes.error) throw new Error(`auction_bids: ${(lastBidsRes.error as { message: string }).message}`);

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

  // Last bid timestamp per player — ordered desc so first occurrence = latest bid
  const lastBidByPlayer = new Map<string, string>();
  for (const bid of lastBidsRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = bid as any;
    const pid = String(row.player_id);
    if (!lastBidByPlayer.has(pid)) {
      lastBidByPlayer.set(pid, row.created_at);
    }
  }

  const announcements: Announcement[] = [];

  for (const team of teams) {
    const pid = String(team.player_id);
    const player = playerById.get(pid);
    const timestamp = lastBidByPlayer.get(pid) ?? new Date(0).toISOString();
    announcements.push({
      type: "buy",
      timestamp,
      playerId: pid,
      playerName: player?.player_name ?? null,
      playerPosition: player?.position ?? null,
      buyerName: userById.get(team.auction_user_id as number) ?? null,
      price: team.purchase_price as number,
    });
  }

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
    announcements.push({
      type: "transfer",
      timestamp: t.completed_at ?? t.created_at,
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
