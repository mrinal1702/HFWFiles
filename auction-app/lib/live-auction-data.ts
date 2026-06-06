import "server-only";

import { createAdminClient } from "@/lib/supabase-server";
import type {
  LiveAuction,
  LiveAuctionParticipant,
  LiveAuctionPlayer,
  ParticipantSummary,
  ParticipantSummaryWithPositions,
  PlayerWithSaleInfo,
  PositionBreakdown,
  SaleWithDetails,
  SaleWithFullDetails,
  SquadPlayer,
} from "@/lib/live-auction-types";

// ─── Position helper (shared between data functions) ──────────────────────────

function categorizePosition(position: string | null | undefined): keyof PositionBreakdown {
  const p = (position ?? "").trim().toLowerCase();
  if (p === "gk" || p.includes("goalkeeper")) return "gk";
  if (p.includes("defend")) return "def";
  if (p.includes("midfield")) return "mid";
  if (p.includes("forward") || p.includes("attack") || p.includes("striker")) return "fwd";
  return "other";
}

const SUPABASE_PAGE_SIZE = 1000;

/** Supabase caps SELECT results at 1000 rows — paginate to fetch everything. */
async function fetchAllRows<T>(
  runQuery: (
    supabase: ReturnType<typeof createAdminClient>,
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const supabase = createAdminClient();
  let from = 0;
  const all: T[] = [];

  while (true) {
    const { data, error } = await runQuery(supabase, from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }

  return all;
}

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
  return fetchAllRows((supabase, from, to) =>
    supabase
      .from("live_auction_players")
      .select("*")
      .eq("auction_id", auctionId)
      .eq("status", "available")
      .order("player_name")
      .range(from, to),
  );
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

/**
 * All players that are not yet assigned to a participant — status `available`
 * or formally `unsold`. Sorted by team name then player name; used for the
 * "Unsold Players" tab on the participant overview.
 */
export async function getUnsoldPlayers(auctionId: string): Promise<LiveAuctionPlayer[]> {
  return fetchAllRows((supabase, from, to) =>
    supabase
      .from("live_auction_players")
      .select("*")
      .eq("auction_id", auctionId)
      .in("status", ["available", "unsold"])
      .order("team_name", { nullsFirst: false })
      .order("player_name")
      .range(from, to),
  );
}

/**
 * Every player in the auction joined with their sale info (if sold).
 * Used by the admin team-browse view so the full team list is visible
 * with available players shown as actionable and sold ones shown as read-only.
 * Ordered by team name then player name.
 */
export async function getAllPlayersWithSaleInfo(
  auctionId: string,
): Promise<PlayerWithSaleInfo[]> {
  const supabase = createAdminClient();

  const [players, { data: sales, error: sErr }] = await Promise.all([
    fetchAllRows((client, from, to) =>
      client
        .from("live_auction_players")
        .select("*")
        .eq("auction_id", auctionId)
        .order("team_name", { nullsFirst: false })
        .order("player_name")
        .range(from, to),
    ),
    supabase
      .from("live_auction_sales")
      .select(
        `id, player_id, participant_id, price, live_auction_participants!participant_id(display_name)`,
      )
      .eq("auction_id", auctionId)
      .eq("is_voided", false),
  ]);

  if (sErr) throw new Error(sErr.message);

  // Build player_id → sale info map (only non-voided sales)
  const saleMap: Record<
    string,
    { sale_id: string; sale_price: number; sold_to_name: string; sold_to_participant_id: string }
  > = {};
  for (const sale of sales ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    saleMap[sale.player_id] = {
      sale_id: sale.id,
      sale_price: sale.price,
      sold_to_name: (sale as any).live_auction_participants?.display_name ?? "Unknown",
      sold_to_participant_id: sale.participant_id,
    };
  }

  return (players ?? []).map((p) => ({
    ...p,
    sale_id: saleMap[p.id]?.sale_id ?? null,
    sale_price: saleMap[p.id]?.sale_price ?? null,
    sold_to_name: saleMap[p.id]?.sold_to_name ?? null,
    sold_to_participant_id: saleMap[p.id]?.sold_to_participant_id ?? null,
  }));
}

/**
 * Per-participant position breakdown derived from non-voided sales.
 * Returns a map of participant_id → { gk, def, mid, fwd, other }.
 * Used by the "All Teams" tab to show squad composition at a glance.
 */
export async function getParticipantPositionBreakdowns(
  auctionId: string,
): Promise<Record<string, PositionBreakdown>> {
  const supabase = createAdminClient();

  const [{ data: sales, error: sErr }, { data: players, error: pErr }] = await Promise.all([
    supabase
      .from("live_auction_sales")
      .select("participant_id, player_id")
      .eq("auction_id", auctionId)
      .eq("is_voided", false),
    supabase
      .from("live_auction_players")
      .select("id, position")
      .eq("auction_id", auctionId),
  ]);

  if (sErr) throw new Error(sErr.message);
  if (pErr) throw new Error(pErr.message);

  const positionMap: Record<string, string | null> = {};
  for (const p of players ?? []) {
    positionMap[p.id] = p.position;
  }

  const breakdown: Record<string, PositionBreakdown> = {};
  for (const sale of sales ?? []) {
    if (!breakdown[sale.participant_id]) {
      breakdown[sale.participant_id] = { gk: 0, def: 0, mid: 0, fwd: 0, other: 0 };
    }
    const cat = categorizePosition(positionMap[sale.player_id]);
    breakdown[sale.participant_id][cat]++;
  }

  return breakdown;
}

/**
 * Participant summaries enriched with per-position player counts.
 * Combines `getParticipantSummaries` and `getParticipantPositionBreakdowns`
 * in a single call; used by the "All Teams" tab.
 */
export async function getParticipantSummariesWithPositions(
  auctionId: string,
  startingBudget: number,
): Promise<ParticipantSummaryWithPositions[]> {
  const [summaries, breakdowns] = await Promise.all([
    getParticipantSummaries(auctionId, startingBudget),
    getParticipantPositionBreakdowns(auctionId),
  ]);

  const empty: PositionBreakdown = { gk: 0, def: 0, mid: 0, fwd: 0, other: 0 };
  return summaries.map((s) => ({
    ...s,
    positions: breakdowns[s.id] ?? { ...empty },
  }));
}

/**
 * All non-voided sales for an auction, enriched with player position, nation,
 * and team name. Ordered by price descending — ready for "top N" displays.
 * Used by the Auction Stats tab.
 */
export async function getAllSalesPublic(auctionId: string): Promise<SaleWithFullDetails[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("live_auction_sales")
    .select(
      `*, live_auction_players!player_id(player_name, fotmob_player_id, position, nation, team_name), live_auction_participants!participant_id(display_name)`,
    )
    .eq("auction_id", auctionId)
    .eq("is_voided", false)
    .order("price", { ascending: false });

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
    position: row.live_auction_players?.position ?? null,
    nation: row.live_auction_players?.nation ?? null,
    team_name: row.live_auction_players?.team_name ?? null,
  }));
}
