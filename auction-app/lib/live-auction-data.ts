import "server-only";

import { createAdminClient } from "@/lib/supabase-server";
import type {
  LiveAuction,
  LiveAuctionParticipant,
  LiveAuctionPlayer,
  ParticipantSummary,
  SaleWithDetails,
  SquadPlayer,
} from "@/lib/live-auction-types";

export async function getLiveAuctions(): Promise<LiveAuction[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("live_auctions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLiveAuction(auctionId: string): Promise<LiveAuction | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("live_auctions")
    .select("*")
    .eq("id", auctionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getLiveAuctionParticipants(
  auctionId: string,
): Promise<LiveAuctionParticipant[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("live_auction_participants")
    .select("*")
    .eq("auction_id", auctionId)
    .order("display_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Returns participants enriched with computed budget stats.
 * total_spent and budget_remaining are derived from non-voided sales.
 */
export async function getParticipantSummaries(
  auctionId: string,
  startingBudget: number,
): Promise<ParticipantSummary[]> {
  const supabase = createAdminClient();

  const [{ data: participants, error: pErr }, { data: sales, error: sErr }] = await Promise.all([
    supabase
      .from("live_auction_participants")
      .select("*")
      .eq("auction_id", auctionId)
      .order("display_name"),
    supabase
      .from("live_auction_sales")
      .select("participant_id, price")
      .eq("auction_id", auctionId)
      .eq("is_voided", false),
  ]);

  if (pErr) throw new Error(pErr.message);
  if (sErr) throw new Error(sErr.message);

  // Aggregate sales by participant
  const spentMap: Record<string, { total: number; count: number }> = {};
  for (const sale of sales ?? []) {
    const existing = spentMap[sale.participant_id];
    spentMap[sale.participant_id] = {
      total: (existing?.total ?? 0) + sale.price,
      count: (existing?.count ?? 0) + 1,
    };
  }

  return (participants ?? []).map((p) => ({
    ...p,
    total_spent: spentMap[p.id]?.total ?? 0,
    budget_remaining: startingBudget - (spentMap[p.id]?.total ?? 0),
    players_count: spentMap[p.id]?.count ?? 0,
  }));
}

/**
 * Recent sales for an auction (newest first), with player and participant names.
 * Includes voided sales so the admin has a full audit log.
 */
export async function getRecentSales(
  auctionId: string,
  limit = 30,
): Promise<SaleWithDetails[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("live_auction_sales")
    .select(
      `*, live_auction_players!player_id(player_name, fotmob_player_id), live_auction_participants!participant_id(display_name)`,
    )
    .eq("auction_id", auctionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    auction_id: row.auction_id,
    player_id: row.player_id,
    participant_id: row.participant_id,
    price: row.price,
    created_at: row.created_at,
    is_voided: row.is_voided,
    void_reason: row.void_reason,
    player_name: row.live_auction_players?.player_name ?? "Unknown",
    fotmob_player_id: row.live_auction_players?.fotmob_player_id ?? "",
    participant_name: row.live_auction_participants?.display_name ?? "Unknown",
  }));
}

/** Non-voided recent sales only — for the public overview page. */
export async function getRecentSalesPublic(
  auctionId: string,
  limit = 20,
): Promise<SaleWithDetails[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("live_auction_sales")
    .select(
      `*, live_auction_players!player_id(player_name, fotmob_player_id), live_auction_participants!participant_id(display_name)`,
    )
    .eq("auction_id", auctionId)
    .eq("is_voided", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    auction_id: row.auction_id,
    player_id: row.player_id,
    participant_id: row.participant_id,
    price: row.price,
    created_at: row.created_at,
    is_voided: row.is_voided,
    void_reason: row.void_reason,
    player_name: row.live_auction_players?.player_name ?? "Unknown",
    fotmob_player_id: row.live_auction_players?.fotmob_player_id ?? "",
    participant_name: row.live_auction_participants?.display_name ?? "Unknown",
  }));
}

export async function getAvailablePlayers(auctionId: string): Promise<LiveAuctionPlayer[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("live_auction_players")
    .select("*")
    .eq("auction_id", auctionId)
    .eq("status", "available")
    .order("player_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Returns the squad for one participant — all non-voided sales with player details.
 * This is the source-of-truth squad view.
 */
export async function getParticipantSquad(
  auctionId: string,
  participantId: string,
): Promise<SquadPlayer[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("live_auction_sales")
    .select(
      `id, price, live_auction_players!player_id(id, fotmob_player_id, player_name, team_name, nation, position)`,
    )
    .eq("auction_id", auctionId)
    .eq("participant_id", participantId)
    .eq("is_voided", false)
    .order("created_at");

  if (error) throw new Error(error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    sale_id: row.id,
    price: row.price,
    player_id: row.live_auction_players?.id ?? "",
    fotmob_player_id: row.live_auction_players?.fotmob_player_id ?? "",
    player_name: row.live_auction_players?.player_name ?? "Unknown",
    team_name: row.live_auction_players?.team_name ?? null,
    nation: row.live_auction_players?.nation ?? null,
    position: row.live_auction_players?.position ?? null,
  }));
}

export async function getParticipantByUserId(
  auctionId: string,
  userId: string,
): Promise<LiveAuctionParticipant | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("live_auction_participants")
    .select("*")
    .eq("auction_id", auctionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getParticipantById(
  participantId: string,
): Promise<LiveAuctionParticipant | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("live_auction_participants")
    .select("*")
    .eq("id", participantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
