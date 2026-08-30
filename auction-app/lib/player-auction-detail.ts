import { cache } from "react";

import {
  loadAuctionDashboard,
  toBidGateContext,
  type AuctionDashboard,
} from "@/lib/auction-dashboard";
import type { AuctionUserRow, BidGateContext, EnrichedLot } from "@/lib/auction-types";
import { createAdminClient } from "@/lib/supabase-server";

export type PlayerGwScore = {
  gameWeekId: number;
  gameWeekName: string;
  score: number;
};

export type PlayerBidEvent = {
  id: number;
  amount: number;
  createdAt: string;
  auctionUserId: number;
  managerName: string | null;
  managerAvatarUrl: string | null;
  teamName: string | null;
};

export type PlayerReleaseEvent = {
  id: number;
  releaseType: "paid" | "free" | string;
  purchasePrice: number;
  refundAmount: number;
  createdAt: string;
  auctionUserId: number;
  managerName: string | null;
  managerAvatarUrl: string | null;
  teamName: string | null;
};

export type PlayerOwnership = {
  auctionUserId: number;
  purchasePrice: number;
  managerName: string | null;
  managerAvatarUrl: string | null;
  teamName: string | null;
} | null;

export type PlayerAuctionDetail = {
  auctionId: number;
  playerId: string;
  playerName: string | null;
  position: string | null;
  club: string | null;
  /** Null when this player is not in the auction lot pool. */
  lot: EnrichedLot | null;
  inAuctionPool: boolean;
  ownership: PlayerOwnership;
  gwScores: PlayerGwScore[];
  bids: PlayerBidEvent[];
  releases: PlayerReleaseEvent[];
  gate: BidGateContext;
  dashboard: AuctionDashboard;
};

async function fetchPlayerMeta(
  admin: ReturnType<typeof createAdminClient>,
  playerId: string,
  competitionId: number | null = null,
): Promise<{ playerName: string | null; position: string | null; club: string | null }> {
  if (competitionId != null) {
    const n = Number(playerId);
    if (Number.isFinite(n)) {
      const cp = await admin
        .from("competition_players")
        .select("player_id, player_name, position, team_name")
        .eq("competition_id", competitionId)
        .eq("player_id", n)
        .maybeSingle();
      if (!cp.error && cp.data) {
        const row = cp.data as {
          player_name: string | null;
          position: string | null;
          team_name: string | null;
        };
        return {
          playerName: row.player_name,
          position: row.position,
          club: row.team_name,
        };
      }
      if (cp.error) throw new Error(`competition_players: ${cp.error.message}`);
    }
    return { playerName: null, position: null, club: null };
  }

  const withClub = await admin
    .from("players")
    .select("player_id, player_name, position, team_name")
    .eq("player_id", playerId)
    .maybeSingle();

  if (!withClub.error && withClub.data) {
    const row = withClub.data as {
      player_name: string | null;
      position: string | null;
      team_name: string | null;
    };
    return {
      playerName: row.player_name,
      position: row.position,
      club: row.team_name,
    };
  }

  const basic = await admin
    .from("players")
    .select("player_id, player_name, position")
    .eq("player_id", playerId)
    .maybeSingle();
  if (basic.error) throw new Error(`players: ${basic.error.message}`);
  if (!basic.data) {
    return { playerName: null, position: null, club: null };
  }
  const row = basic.data as { player_name: string | null; position: string | null };
  return { playerName: row.player_name, position: row.position, club: null };
}

async function fetchGwScoresForPlayer(
  admin: ReturnType<typeof createAdminClient>,
  playerId: string,
): Promise<PlayerGwScore[]> {
  const numericId = Number(playerId);
  if (!Number.isFinite(numericId)) return [];

  let rows: Array<{ game_week_id: number; score: number }> = [];

  const viewRes = await admin
    .from("player_scores")
    .select("game_week_id, score")
    .eq("player_id", numericId);
  if (!viewRes.error) {
    rows = (viewRes.data ?? []).map((r) => ({
      game_week_id: Number((r as { game_week_id: number }).game_week_id),
      score: Number((r as { score: number }).score),
    }));
  } else {
    const tableRes = await admin
      .from("Player_Scores")
      .select("game_week_id, Score")
      .eq("player_id", numericId);
    if (tableRes.error) throw new Error(`Player_Scores: ${tableRes.error.message}`);
    rows = (tableRes.data ?? []).map((r) => ({
      game_week_id: Number((r as { game_week_id: number }).game_week_id),
      score: Number((r as { Score: number }).Score),
    }));
  }

  if (rows.length === 0) return [];

  const gwIds = [...new Set(rows.map((r) => r.game_week_id))].sort((a, b) => a - b);
  const gwRes = await admin.from("Game_Weeks").select("id, GW_Name").in("id", gwIds);
  if (gwRes.error) throw new Error(`Game_Weeks: ${gwRes.error.message}`);

  const nameById = new Map<number, string>();
  for (const g of gwRes.data ?? []) {
    nameById.set(Number((g as { id: number }).id), String((g as { GW_Name: string }).GW_Name));
  }

  return rows
    .map((r) => ({
      gameWeekId: r.game_week_id,
      gameWeekName: nameById.get(r.game_week_id) ?? `GW ${r.game_week_id}`,
      score: r.score,
    }))
    .sort((a, b) => a.gameWeekId - b.gameWeekId);
}

function managerFields(
  userById: Map<number, AuctionUserRow>,
  auctionUserId: number,
): Pick<PlayerBidEvent, "managerName" | "managerAvatarUrl" | "teamName"> {
  const u = userById.get(auctionUserId);
  return {
    managerName: u?.name ?? null,
    managerAvatarUrl: u?.avatar_url ?? null,
    teamName: u?.team_name ?? null,
  };
}

/**
 * Rich in-auction player story for members (including archived auctions they still belong to).
 * Works when the player is outside the lot pool (e.g. linked from match scores) — lot/bids may be empty.
 */
export const loadPlayerAuctionDetail = cache(
  async (
    auctionId: number,
    playerId: string,
    authUserId: string | null,
  ): Promise<PlayerAuctionDetail | null> => {
    const admin = createAdminClient();
    const dashboard = await loadAuctionDashboard(auctionId, authUserId);
    if (!dashboard.auction) return null;

    const competitionId =
      dashboard.auction && "competition_id" in dashboard.auction
        ? Number((dashboard.auction as { competition_id?: number | null }).competition_id)
        : null;
    const lot = dashboard.lots.find((l) => l.player_id === playerId) ?? null;
    const meta = lot
      ? {
          playerName: lot.player_name,
          position: lot.position,
          club: lot.club,
        }
      : await fetchPlayerMeta(
          admin,
          playerId,
          Number.isFinite(competitionId) ? competitionId : null,
        );

    const [teamRes, bidsRes, releasesRes, gwScores] = await Promise.all([
      admin
        .from("auction_teams")
        .select("auction_user_id, purchase_price")
        .eq("auction_id", auctionId)
        .eq("player_id", playerId)
        .maybeSingle(),
      admin
        .from("auction_bids")
        .select("id, amount, auction_user_id, created_at")
        .eq("auction_id", auctionId)
        .eq("player_id", playerId)
        .order("created_at", { ascending: true }),
      admin
        .from("auction_releases")
        .select(
          "id, release_type, purchase_price, refund_amount, created_at, auction_user_id",
        )
        .eq("auction_id", auctionId)
        .eq("player_id", playerId)
        .order("created_at", { ascending: true }),
      fetchGwScoresForPlayer(admin, playerId),
    ]);

    if (teamRes.error) throw new Error(`auction_teams: ${teamRes.error.message}`);
    if (bidsRes.error) throw new Error(`auction_bids: ${bidsRes.error.message}`);
    if (releasesRes.error) throw new Error(`auction_releases: ${releasesRes.error.message}`);

    let ownership: PlayerOwnership = null;
    if (teamRes.data) {
      const auctionUserId = Number(
        (teamRes.data as { auction_user_id: number }).auction_user_id,
      );
      const purchasePrice = Number(
        (teamRes.data as { purchase_price: number }).purchase_price,
      );
      ownership = {
        auctionUserId,
        purchasePrice,
        ...managerFields(dashboard.userById, auctionUserId),
      };
    }

    const bids: PlayerBidEvent[] = (bidsRes.data ?? []).map((row) => {
      const r = row as {
        id: number;
        amount: number;
        auction_user_id: number;
        created_at: string;
      };
      return {
        id: Number(r.id),
        amount: Number(r.amount),
        createdAt: String(r.created_at),
        auctionUserId: Number(r.auction_user_id),
        ...managerFields(dashboard.userById, Number(r.auction_user_id)),
      };
    });

    const releases: PlayerReleaseEvent[] = (releasesRes.data ?? []).map((row) => {
      const r = row as {
        id: number;
        release_type: string;
        purchase_price: number;
        refund_amount: number;
        created_at: string;
        auction_user_id: number;
      };
      return {
        id: Number(r.id),
        releaseType: r.release_type,
        purchasePrice: Number(r.purchase_price),
        refundAmount: Number(r.refund_amount),
        createdAt: String(r.created_at),
        auctionUserId: Number(r.auction_user_id),
        ...managerFields(dashboard.userById, Number(r.auction_user_id)),
      };
    });

    return {
      auctionId,
      playerId,
      playerName: meta.playerName ?? lot?.player_name ?? null,
      position: meta.position ?? lot?.position ?? null,
      club: meta.club ?? lot?.club ?? null,
      lot,
      inAuctionPool: lot != null,
      ownership,
      gwScores,
      bids,
      releases,
      gate: toBidGateContext(dashboard),
      dashboard,
    };
  },
);
