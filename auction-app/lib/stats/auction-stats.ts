import fs from "node:fs";
import path from "node:path";

import { fetchAuctionUserNames } from "@/lib/auction-users-query";
import { COMPETITION_ID_TO_SLUG } from "@/lib/scoring/match-scores/sheets";
import { createAdminClient } from "@/lib/supabase-server";
import { fantasyTeamLabel } from "@/lib/team-name";

/**
 * In-auction Stats page data.
 *
 * Scores are NOT queried here: they come from files precomputed when a gameweek is published
 * (`scripts/build-auction-stats.mjs`, run by `gameweek.mjs best-xi --apply`) and deployed with the
 * other gameweek data. A page load only reads those files (cached in memory per server instance)
 * plus two small lookups: manager names and which players are owned right now (for free agents).
 */

export type StatsPos = "GK" | "DEF" | "MID" | "FWD";

export type StatsGameweek = { id: number; round: number; label: string };

export type StatsPlayer = {
  id: number;
  name: string;
  club: string;
  pos: StatsPos;
  /** Scored in a match but not in the auction pool (cannot be bought). */
  pool: boolean;
  /** gameweek id → [points, minutes] */
  gw: Record<string, [number, number]>;
};

export type StatsStint = { player: number; manager: number; price: number; gws: number[] };

type PlayersFile = { builtAt: string; through: string; gameweeks: StatsGameweek[]; players: StatsPlayer[] };
type AuctionFile = { auctionId: number; builtAt: string; gameweeks: number[]; stints: StatsStint[] };

export type AuctionStatsData = {
  builtAt: string;
  gameweeks: StatsGameweek[];
  players: StatsPlayer[];
  stints: StatsStint[];
  managers: Record<number, string>;
  /** Player ids currently in any squad in this auction. */
  ownedNow: number[];
};

const fileCache = new Map<string, unknown>();

function readStatsFile<T>(slug: string, name: string): T | null {
  const file = path.join(process.cwd(), "data", "competitions", slug, "stats", name);
  if (fileCache.has(file)) return fileCache.get(file) as T | null;
  const value = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
  fileCache.set(file, value);
  return value;
}

export async function loadAuctionStats(auctionId: number): Promise<AuctionStatsData | null> {
  const admin = createAdminClient();
  const { data: auction, error } = await admin
    .from("Auctions")
    .select("id, competition_id")
    .eq("id", auctionId)
    .maybeSingle();
  if (error) throw new Error(`Auctions: ${error.message}`);
  const slug = auction?.competition_id != null ? COMPETITION_ID_TO_SLUG[Number(auction.competition_id)] : undefined;
  if (!slug) return null;

  const players = readStatsFile<PlayersFile>(slug, "players.json");
  const auctionFile = readStatsFile<AuctionFile>(slug, `auction-${auctionId}.json`);
  if (!players) return null;

  const [names, owned] = await Promise.all([
    fetchAuctionUserNames(admin, auctionId),
    admin.from("auction_teams").select("player_id").eq("auction_id", auctionId).limit(5000),
  ]);
  if (owned.error) throw new Error(`auction_teams: ${owned.error.message}`);

  return {
    builtAt: players.builtAt,
    gameweeks: players.gameweeks,
    players: players.players,
    stints: auctionFile?.stints ?? [],
    managers: Object.fromEntries(names.map((u) => [u.id, fantasyTeamLabel(u.team_name, u.name)])),
    ownedNow: [...new Set((owned.data ?? []).map((r) => Number(r.player_id)))],
  };
}
