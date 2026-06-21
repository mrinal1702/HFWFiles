import { cache } from "react";
import { cookies } from "next/headers";

import {
  AUCTION_ACTOR_COOKIE,
  parseActorCookie,
  resolveActorFromIds,
} from "@/lib/auction-actor-cookie";
import { getAuthUser } from "@/lib/auth/get-user";
import { isGoalkeeperPosition } from "@/lib/bid-ui-messages";
import type { AuctionUserRow, BidGateContext, EnrichedLot } from "@/lib/auction-types";
import { fetchAuctionUsers } from "@/lib/auction-users-query";
import { finalizeAuctionHardDeadline, finalizeExpiredLots } from "@/lib/bidding";
import { createAdminClient } from "@/lib/supabase-server";

export type { AuctionUserRow, BidGateContext, EnrichedLot } from "@/lib/auction-types";

const SUPABASE_PAGE_SIZE = 1000;
const PLAYER_ID_BATCH_SIZE = 200;

async function fetchAllAuctionLots(
  admin: ReturnType<typeof createAdminClient>,
  auctionId: number,
): Promise<Record<string, unknown>[]> {
  let from = 0;
  const all: Record<string, unknown>[] = [];

  while (true) {
    const { data, error } = await admin
      .from("auction_lots")
      .select("*")
      .eq("auction_id", auctionId)
      .order("player_id", { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(`auction_lots: ${error.message}`);
    if (!data?.length) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }

  return all;
}

async function fetchPlayersByIds(
  admin: ReturnType<typeof createAdminClient>,
  playerIds: string[],
): Promise<Record<string, unknown>[]> {
  if (!playerIds.length) return [];

  const all: Record<string, unknown>[] = [];
  for (let i = 0; i < playerIds.length; i += PLAYER_ID_BATCH_SIZE) {
    const batch = playerIds.slice(i, i + PLAYER_ID_BATCH_SIZE);
    const withClub = await admin
      .from("players")
      .select("player_id, player_name, position, team_name, team_id")
      .in("player_id", batch);
    if (withClub.error) {
      const basic = await admin
        .from("players")
        .select("player_id, player_name, position")
        .in("player_id", batch);
      if (basic.error) throw new Error(`players: ${basic.error.message}`);
      all.push(...((basic.data ?? []) as Record<string, unknown>[]));
    } else {
      all.push(...((withClub.data ?? []) as Record<string, unknown>[]));
    }
  }

  return all;
}

/** PostgREST / Postgres when an expected RPC was never applied in Supabase. */
function isMissingRpc(message: string | undefined, rpcName: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("could not find the function") ||
    (m.includes("does not exist") && m.includes(rpcName.toLowerCase())) ||
    m.includes("42883") ||
    m.includes("pgrst202")
  );
}

export type AuctionDashboard = {
  auctionId: number;
  auction: {
    id: number;
    name: string | null;
    hard_deadline_at: string | null;
    initiation_deadline_at: string | null;
    raise_deadline_at: string | null;
    is_active: boolean | null;
  } | null;
  users: AuctionUserRow[];
  userById: Map<number, AuctionUserRow>;
  lots: EnrichedLot[];
  actorUserId: number | null;
  me: AuctionUserRow | null;
  viewerMode: boolean;
  biddingClosed: boolean;
  biddingClosedReason: string | null;
  /** True once initiation_deadline_at has passed — uninitiated lots can no longer be opened. */
  initiationClosed: boolean;
  /** True once raise_deadline_at has passed — all bids must raise by at least 5. */
  raiseModeActive: boolean;
  meRosterSlots: number;
  meGkCount: number;
};

export function toBidGateContext(d: AuctionDashboard): BidGateContext {
  return {
    biddingClosed: d.biddingClosed,
    biddingClosedReason: d.biddingClosedReason,
    viewerMode: d.viewerMode,
    me: d.me,
    meRosterSlots: d.meRosterSlots,
    meGkCount: d.meGkCount,
    initiationClosed: d.initiationClosed,
    raiseModeActive: d.raiseModeActive,
  };
}

export const loadAuctionDashboard = cache(
  async (auctionId: number, authUserId: string | null): Promise<AuctionDashboard> => {
  const admin = createAdminClient();
  const cookieStore = await cookies();
  const actorMap = parseActorCookie(cookieStore.get(AUCTION_ACTOR_COOKIE)?.value);

  const [auctionRes, usersRes, lotsRes] = await Promise.all([
    admin.from("Auctions").select("id,name,hard_deadline_at,initiation_deadline_at,raise_deadline_at,is_active").eq("id", auctionId).maybeSingle(),
    fetchAuctionUsers(admin, auctionId),
    fetchAllAuctionLots(admin, auctionId),
  ]);

  const auction = auctionRes.data as AuctionDashboard["auction"];
  let users = usersRes;
  let rawLots = lotsRes;
  const refetchAuctionState = async (): Promise<void> => {
    const [usersAgain, lotsAgain] = await Promise.all([
      fetchAuctionUsers(admin, auctionId),
      fetchAllAuctionLots(admin, auctionId),
    ]);
    users = usersAgain;
    rawLots = lotsAgain;
  };

  const now = Date.now();
  const hardMs = auction?.hard_deadline_at ? Date.parse(auction.hard_deadline_at) : NaN;
  const pastHard = Number.isFinite(hardMs) && now >= hardMs;

  const initiationMs = auction?.initiation_deadline_at ? Date.parse(auction.initiation_deadline_at) : NaN;
  const initiationClosed = Number.isFinite(initiationMs) && now >= initiationMs;

  const raiseMs = auction?.raise_deadline_at ? Date.parse(auction.raise_deadline_at) : NaN;
  const raiseModeActive = Number.isFinite(raiseMs) && now >= raiseMs;
  const needsRollingFinalize =
    !pastHard &&
    rawLots.some((r) => {
      const row = r as { status: unknown; expires_at?: unknown };
      if (String(row.status) !== "bidding" || row.expires_at == null) return false;
      const exp = Date.parse(String(row.expires_at));
      return Number.isFinite(exp) && exp <= now;
    });

  if (needsRollingFinalize) {
    const { data: fin, rpcError } = await finalizeExpiredLots(admin, { auctionId });
    if (rpcError) {
      if (isMissingRpc(rpcError.message, "finalize_expired_lots")) {
        console.error(
          "[auction-dashboard] finalize_expired_lots missing in DB; run scripts/sql/auction-bidding.sql section 8 in Supabase SQL Editor. PostgREST:",
          rpcError.message,
        );
      } else {
        throw new Error(`finalize_expired_lots: ${rpcError.message}`);
      }
    } else if (fin?.ok === true) {
      await refetchAuctionState();
    } else if (fin && fin.ok === false) {
      const code = fin.error;
      if (code === "auction_not_found" || code === "hard_deadline_not_set") {
        console.warn("[auction-dashboard] rolling finalize returned ok=false:", code);
      } else {
        throw new Error(`finalize_expired_lots: ${code}`);
      }
    }
  }

  const needsHardFinalize =
    pastHard &&
    auction != null &&
    rawLots.some((r) => {
      const s = String((r as { status: unknown }).status);
      return s === "bidding" || s === "uninitiated";
    });

  if (needsHardFinalize) {
    const { data: fin, rpcError } = await finalizeAuctionHardDeadline(admin, { auctionId });

    if (rpcError) {
      if (isMissingRpc(rpcError.message, "finalize_auction_hard_deadline")) {
        console.error(
          "[auction-dashboard] finalize_auction_hard_deadline missing in DB; run scripts/sql/auction-bidding.sql section 7 in Supabase SQL Editor. PostgREST:",
          rpcError.message,
        );
      } else {
        throw new Error(`finalize_auction_hard_deadline: ${rpcError.message}`);
      }
    } else if (fin?.ok === true) {
      await refetchAuctionState();
    } else if (fin && fin.ok === false) {
      const code = fin.error;
      if (code === "deadline_not_reached" || code === "hard_deadline_not_set") {
        console.warn("[auction-dashboard] finalize returned ok=false:", code);
      } else {
        throw new Error(`finalize_auction_hard_deadline: ${code}`);
      }
    }
  }

  const userById = new Map(users.map((u) => [u.id, u]));

  let actorUserId: number | null = null;
  let viewerMode = false;
  let me: AuctionUserRow | null = null;

  if (authUserId) {
    const memberRow = users.find((u) => u.user_id === authUserId) ?? null;
    if (memberRow) {
      me = memberRow;
      actorUserId = memberRow.id;
      viewerMode = false;
    } else {
      me = null;
      actorUserId = null;
      viewerMode = true;
    }
  } else {
    const resolved = resolveActorFromIds(
      auctionId,
      users.map((u) => u.id),
      actorMap,
    );
    actorUserId = resolved.actorUserId;
    viewerMode = resolved.viewerMode;
    me = actorUserId != null ? userById.get(actorUserId) ?? null : null;
  }

  const biddingClosed = auction?.is_active === false || pastHard;
  let biddingClosedReason: string | null = null;
  if (auction?.is_active === false) {
    biddingClosedReason = "This auction is paused right now.";
  } else if (pastHard) {
    biddingClosedReason = "Bidding has ended — the auction deadline has passed. All times are shown in your local time.";
  }

  const playerIds = [...new Set(rawLots.map((r) => String(r.player_id)))];
  const bidIds = rawLots
    .map((r) => r.current_high_bid_id as number | null)
    .filter((id): id is number => id != null);

  const teamsForAuctionP = admin
    .from("auction_teams")
    .select("player_id, auction_user_id, purchase_price")
    .eq("auction_id", auctionId);

  let playerRows: Record<string, unknown>[] = [];
  if (playerIds.length) {
    playerRows = await fetchPlayersByIds(admin, playerIds);
  }

  const [teamsForAuction, bidsRes] = await Promise.all([
    teamsForAuctionP,
    bidIds.length
      ? admin.from("auction_bids").select("id, amount, auction_user_id").in("id", bidIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
  ]);

  if (teamsForAuction.error) throw new Error(`auction_teams: ${teamsForAuction.error.message}`);
  if (bidsRes.error) throw new Error(`auction_bids: ${bidsRes.error.message}`);

  const playerById = new Map<
    string,
    { player_name: string | null; position: string | null; club: string | null; team_id: number | null }
  >();
  for (const p of playerRows) {
    const row = p as {
      player_id: string;
      player_name: string | null;
      position: string | null;
      team_name?: string | null;
      team_id?: number | null;
    };
    const tid = row.team_id;
    const teamId =
      typeof tid === "number" && Number.isFinite(tid)
        ? tid
        : tid != null && String(tid).trim() !== ""
          ? Number(tid)
          : null;
    playerById.set(String(row.player_id), {
      player_name: row.player_name ?? null,
      position: row.position ?? null,
      club: row.team_name ?? null,
      team_id: teamId != null && Number.isFinite(teamId) ? teamId : null,
    });
  }

  const bidById = new Map<number, { amount: number; auction_user_id: number }>();
  for (const b of bidsRes.data ?? []) {
    const row = b as { id: number; amount: number; auction_user_id: number };
    bidById.set(row.id, { amount: row.amount, auction_user_id: row.auction_user_id });
  }

  const winnerByPlayer = new Map<string, { auction_user_id: number; purchase_price: number }>();
  for (const t of teamsForAuction.data ?? []) {
    const row = t as { player_id: string; auction_user_id: number; purchase_price: number };
    winnerByPlayer.set(String(row.player_id), {
      auction_user_id: row.auction_user_id,
      purchase_price: row.purchase_price,
    });
  }

  const lots: EnrichedLot[] = rawLots.map((l: Record<string, unknown>) => {
    const pid = String(l.player_id);
    const meta = playerById.get(pid);
    const status = String(l.status);
    const soldTo = status === "sold" ? winnerByPlayer.get(pid) : undefined;

    if (soldTo != null) {
      const bidderUser = userById.get(soldTo.auction_user_id);
      return {
        player_id: pid,
        player_name: meta?.player_name ?? null,
        position: meta?.position ?? null,
        club: meta?.club ?? null,
        team_id: meta?.team_id ?? null,
        status,
        expires_at: l.expires_at != null ? String(l.expires_at) : null,
        high_bidder_id: soldTo.auction_user_id,
        high_bidder_name: bidderUser?.name ?? null,
        high_amount: soldTo.purchase_price,
      };
    }

    const bidId = l.current_high_bid_id as number | null;
    const bid = bidId != null ? bidById.get(bidId) : undefined;
    const bidder = bid ? userById.get(bid.auction_user_id) : undefined;
    return {
      player_id: pid,
      player_name: meta?.player_name ?? null,
      position: meta?.position ?? null,
      club: meta?.club ?? null,
      team_id: meta?.team_id ?? null,
      status,
      expires_at: l.expires_at != null ? String(l.expires_at) : null,
      high_bidder_id: bid?.auction_user_id ?? null,
      high_bidder_name: bidder?.name ?? null,
      high_amount: bid?.amount ?? null,
    };
  });

  let meRosterSlots = 0;
  let meGkCount = 0;

  if (me) {
    const teamsRes = await admin
      .from("auction_teams")
      .select("player_id")
      .eq("auction_id", auctionId)
      .eq("auction_user_id", me.id);

    if (teamsRes.error) throw new Error(`auction_teams: ${teamsRes.error.message}`);

    for (const t of teamsRes.data ?? []) {
      const row = t as { player_id: string };
      meRosterSlots += 1;
      const pos = playerById.get(String(row.player_id))?.position ?? null;
      if (isGoalkeeperPosition(pos)) meGkCount += 1;
    }

    for (const lot of lots) {
      if (lot.status !== "bidding" || lot.high_bidder_id !== me.id) continue;
      meRosterSlots += 1;
      if (isGoalkeeperPosition(lot.position)) meGkCount += 1;
    }
  }

  return {
    auctionId,
    auction,
    users,
    userById,
    lots,
    actorUserId,
    me,
    viewerMode,
    biddingClosed,
    biddingClosedReason,
    initiationClosed,
    raiseModeActive,
    meRosterSlots,
    meGkCount,
  };
  },
);

export type MyAuctionRow = {
  id: number;
  name: string | null;
  is_active: boolean | null;
  hard_deadline_at: string | null;
  join_code: string | null;
  max_participants: number | null;
};

export const loadMyAuctionsForUser = cache(async (authUserId: string): Promise<MyAuctionRow[]> => {
  const admin = createAdminClient();
  const { data: seats, error: seatErr } = await admin
    .from("auction_users")
    .select("auction_id")
    .eq("user_id", authUserId);
  if (seatErr) throw new Error(seatErr.message);
  const ids = [...new Set((seats ?? []).map((r: { auction_id: number }) => r.auction_id))];
  if (ids.length === 0) return [];

  const { data: auctions, error: aErr } = await admin
    .from("Auctions")
    .select("id,name,is_active,hard_deadline_at,join_code,max_participants")
    .in("id", ids)
    .order("id", { ascending: false });
  if (aErr) throw new Error(aErr.message);
  return (auctions ?? []) as MyAuctionRow[];
});

/** Use in auction pages: resolves current Supabase user and loads dashboard (cached per user + auction). */
export async function loadAuctionDashboardForViewer(auctionId: number): Promise<AuctionDashboard> {
  const user = await getAuthUser();
  return loadAuctionDashboard(auctionId, user?.id ?? null);
}

export type CompetitorView = {
  competitor: AuctionUserRow | null;
  sold: EnrichedLot[];
  leading: EnrichedLot[];
};

export const loadCompetitorView = cache(
  async (
    auctionId: number,
    competitorUserId: number,
    authUserId: string | null,
  ): Promise<CompetitorView> => {
  const admin = createAdminClient();
  const base = await loadAuctionDashboard(auctionId, authUserId);
  const competitor = base.users.find((u) => u.id === competitorUserId) ?? null;

  const teamsRes = await admin
    .from("auction_teams")
    .select("player_id, purchase_price")
    .eq("auction_id", auctionId)
    .eq("auction_user_id", competitorUserId);

  if (teamsRes.error) throw new Error(teamsRes.error.message);

  const soldIds = (teamsRes.data ?? []).map((t) => String((t as { player_id: string }).player_id));
  const priceByPlayer = new Map<string, number>();
  for (const t of teamsRes.data ?? []) {
    const row = t as { player_id: string; purchase_price: number };
    priceByPlayer.set(String(row.player_id), row.purchase_price);
  }

  const sold: EnrichedLot[] = [];
  for (const lot of base.lots) {
    if (!soldIds.includes(lot.player_id)) continue;
    sold.push({
      ...lot,
      status: "sold",
      high_amount: priceByPlayer.get(lot.player_id) ?? lot.high_amount,
      high_bidder_id: competitorUserId,
      high_bidder_name: competitor?.name ?? null,
    });
  }
  sold.sort((a, b) => a.player_id.localeCompare(b.player_id));

  const leading = base.lots.filter(
    (l) => l.status === "bidding" && l.high_bidder_id === competitorUserId,
  );

  return { competitor, sold, leading };
  },
);
