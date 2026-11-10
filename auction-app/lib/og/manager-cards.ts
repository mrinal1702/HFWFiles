import "server-only";

import { fetchPlayerMetaByIds } from "@/lib/players-query";
import { getLeaderboardData, getPointsGwContext } from "@/lib/scoring/leaderboard-data";
import { createAdminClient } from "@/lib/supabase-server";
import { fantasyTeamLabel } from "@/lib/team-name";

import type { OgAuctionSummary } from "./auction-summary";

/**
 * Read-only data for a manager's link-preview cards (Project Socialize H-2).
 * Every query is scoped by auction_id AND the seat id, so a seat from another auction never matches.
 */

export type OgSquad = {
  label: string;
  managerName: string;
  playerCount: number;
  budgetRemaining: number;
  top: Array<{ name: string; position: string | null; club: string | null; price: number }>;
};

export async function loadOgSquad(
  auction: OgAuctionSummary,
  auctionUserId: number,
): Promise<OgSquad | null> {
  if (!Number.isFinite(auctionUserId) || auctionUserId <= 0) return null;
  const admin = createAdminClient();

  const [seatRes, teamRes] = await Promise.all([
    admin
      .from("auction_users")
      .select("id, name, team_name, budget_remaining")
      .eq("auction_id", auction.id)
      .eq("id", auctionUserId)
      .maybeSingle(),
    admin
      .from("auction_teams")
      .select("player_id, purchase_price")
      .eq("auction_id", auction.id)
      .eq("auction_user_id", auctionUserId),
  ]);
  if (seatRes.error || !seatRes.data || teamRes.error) return null;

  const seat = seatRes.data as {
    name: string | null;
    team_name?: string | null;
    budget_remaining: number;
  };
  const rows = (teamRes.data ?? []) as Array<{ player_id: string | number; purchase_price: number }>;
  const topRows = [...rows].sort((a, b) => b.purchase_price - a.purchase_price).slice(0, 5);
  const meta = await fetchPlayerMetaByIds(
    admin,
    topRows.map((r) => String(r.player_id)),
    auction.competitionId,
  );

  return {
    label: fantasyTeamLabel(seat.team_name, seat.name),
    managerName: seat.name?.trim() || "Manager",
    playerCount: rows.length,
    budgetRemaining: seat.budget_remaining,
    top: topRows.map((r) => {
      const m = meta[String(r.player_id)];
      return {
        name: m?.player_name ?? String(r.player_id),
        position: m?.position ?? null,
        club: m?.club ?? null,
        price: r.purchase_price,
      };
    }),
  };
}

export type OgPoints = {
  label: string;
  managerName: string;
  gwName: string | null;
  gwTotal: number | null;
  seasonTotal: number | null;
  seasonRank: number | null;
  top: Array<{ name: string; club: string | null; score: number }>;
};

/** Points for the default gameweek (latest scored), plus season total and rank. */
export async function loadOgPoints(
  auction: OgAuctionSummary,
  auctionUserId: number,
): Promise<OgPoints | null> {
  if (!Number.isFinite(auctionUserId) || auctionUserId <= 0) return null;
  const [lb, ctx] = await Promise.all([
    getLeaderboardData(auction.id),
    getPointsGwContext(auction.id, null),
  ]);
  const standing = lb.standings.find((s) => s.userId === auctionUserId) ?? null;
  const squad = ctx.squads?.find((s) => s.userId === auctionUserId) ?? null;
  if (!standing && !squad) return null;

  const scored = (squad?.players ?? []).filter((p) => p.score != null);
  const xi = scored.some((p) => p.isBestXi != null) ? scored.filter((p) => p.isBestXi) : scored;
  const top = [...xi]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5)
    .map((p) => ({ name: p.playerName ?? p.playerId, club: p.club, score: p.score ?? 0 }));

  const name = squad?.name ?? standing?.name ?? "Manager";
  const teamName = squad?.teamName ?? standing?.teamName ?? null;
  return {
    label: fantasyTeamLabel(teamName, name),
    managerName: name,
    gwName: ctx.selectedGw?.name ?? null,
    gwTotal: squad?.totalGwScore ?? null,
    seasonTotal: standing && lb.gameWeeks.length ? standing.total : null,
    seasonRank: standing && lb.gameWeeks.length ? standing.rank : null,
    top,
  };
}
