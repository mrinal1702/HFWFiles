import { createAdminClient } from "@/lib/supabase-server";
import type { XiRole } from "@/lib/best-xi-display";
import { parseXiRole } from "@/lib/best-xi-display";
import { fetchAuctionUserNames } from "@/lib/auction-users-query";
import { loadBestXiOverlay } from "@/lib/best-xi-overlay";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type GwInfo = {
  id: number;
  name: string;
};

export type StandingEntry = {
  userId: number;
  name: string;
  teamName: string | null;
  /** GW id (as string key) → total score for that GW */
  scoresByGwId: Record<string, number>;
  total: number;
  rank: number;
};

export type GwSquadPlayer = {
  playerId: string;
  playerName: string | null;
  position: string | null;
  club: string | null;
  purchasePrice: number;
  /** null = scores not uploaded yet for this player */
  score: number | null;
  /** null = formation logic not run yet; true = Best XI; false = bench */
  isBestXi: boolean | null;
  /** Formation slot when in Best XI (D/M/F/GK); null on bench or before XI published */
  xiRole: XiRole | null;
};

export type ParticipantGwSquad = {
  userId: number;
  name: string;
  teamName: string | null;
  players: GwSquadPlayer[];
  /** Total GW score from auction_leaderboard; null if scores not yet published */
  totalGwScore: number | null;
  /** e.g. "3-5-2" — display only */
  formation: string | null;
};

export type LeaderboardData = {
  standings: StandingEntry[];
  gameWeeks: GwInfo[];
};

export type GameweekPanel = {
  gw: GwInfo;
  squads: ParticipantGwSquad[] | null;
  squadsAreLocked: boolean;
};

// ─── Loaders ─────────────────────────────────────────────────────────────────

/** Auction-agnostic GW scores from Player_Scores (keyed by FotMob player_id). */
async function fetchPlayerGameweekScores(
  admin: ReturnType<typeof createAdminClient>,
  gameWeekId: number,
  playerIds: string[],
): Promise<Map<string, number>> {
  const scoreMap = new Map<string, number>();
  const uniqueIds = [
    ...new Set(playerIds.map((id) => Number(id)).filter((n) => Number.isFinite(n))),
  ];
  if (!uniqueIds.length) return scoreMap;

  const batchSize = 300;
  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    const viewRes = await admin
      .from("player_scores")
      .select("player_id, score")
      .eq("game_week_id", gameWeekId)
      .in("player_id", batch);

    if (!viewRes.error) {
      for (const row of viewRes.data ?? []) {
        scoreMap.set(String(row.player_id), Number(row.score));
      }
      continue;
    }

    const tableRes = await admin
      .from("Player_Scores")
      .select("player_id, Score")
      .eq("game_week_id", gameWeekId)
      .in("player_id", batch);
    if (tableRes.error) throw new Error(`Player_Scores: ${tableRes.error.message}`);
    for (const row of tableRes.data ?? []) {
      scoreMap.set(String(row.player_id), Number(row.Score));
    }
  }

  return scoreMap;
}

/** All-GW standings for the Standings tab. */
export async function getLeaderboardData(auctionId: number): Promise<LeaderboardData> {
  const admin = createAdminClient();

  const [users, lbRes] = await Promise.all([
    fetchAuctionUserNames(admin, auctionId),
    admin
      .from("auction_leaderboard")
      .select("auction_user_id, game_week_id, total_score")
      .eq("auction_id", auctionId),
  ]);

  if (lbRes.error) throw new Error(`auction_leaderboard: ${lbRes.error.message}`);
  const lbRows = (lbRes.data ?? []) as Array<{
    auction_user_id: number;
    game_week_id: number;
    total_score: number;
  }>;

  // Collect unique GW ids that have scores, then fetch their names
  const gwIdSet = new Set(lbRows.map((r) => r.game_week_id));
  const gwIds = [...gwIdSet].sort((a, b) => a - b);

  let gameWeeks: GwInfo[] = [];
  if (gwIds.length > 0) {
    const gwRes = await admin
      .from("Game_Weeks")
      .select("id, GW_Name")
      .in("id", gwIds)
      .order("id", { ascending: true });
    if (gwRes.error) throw new Error(`Game_Weeks: ${gwRes.error.message}`);
    gameWeeks = (gwRes.data ?? []).map((r) => ({
      id: r.id as number,
      name: r.GW_Name as string,
    }));
  }

  // Build per-user score map
  const scoresByUser = new Map<number, Record<string, number>>();
  for (const row of lbRows) {
    if (!scoresByUser.has(row.auction_user_id)) {
      scoresByUser.set(row.auction_user_id, {});
    }
    scoresByUser.get(row.auction_user_id)![String(row.game_week_id)] = Number(row.total_score);
  }

  // Build and rank standings
  const unsorted = users.map((u) => {
    const gwScores = scoresByUser.get(u.id) ?? {};
    const total = Object.values(gwScores).reduce((sum, s) => sum + s, 0);
    return {
      userId: u.id,
      name: u.name ?? "—",
      teamName: u.team_name?.trim() || null,
      scoresByGwId: gwScores,
      total,
    };
  });

  unsorted.sort((a, b) => b.total - a.total);

  const standings: StandingEntry[] = unsorted.map((entry, idx, arr) => {
    // Tied managers share the same rank
    const rank = idx === 0 ? 1 : arr[idx - 1].total === entry.total ? 0 : idx + 1;
    return {
      ...entry,
      rank: rank === 0 ? (arr.findIndex((e, i) => i < idx && e.total === entry.total) + 1) : rank,
    };
  });

  // Correct rank for ties: use the first occurrence's rank for all tied entries
  const corrected = standings.map((e, idx, arr) => {
    if (idx === 0) return e;
    const firstSameIdx = arr.findIndex((x) => x.total === e.total);
    return { ...e, rank: arr[firstSameIdx].rank };
  });

  return { standings: corrected, gameWeeks };
}

/**
 * Current live squads from auction_teams — used as a fallback when no
 * gameweek snapshot has been locked yet.
 */
export async function getCurrentSquads(
  auctionId: number,
  gameWeekId?: number,
): Promise<ParticipantGwSquad[]> {
  const admin = createAdminClient();

  const [users, teamsRes] = await Promise.all([
    fetchAuctionUserNames(admin, auctionId),
    admin
      .from("auction_teams")
      .select("auction_user_id, player_id, purchase_price")
      .eq("auction_id", auctionId),
  ]);

  if (teamsRes.error) throw new Error(`auction_teams: ${teamsRes.error.message}`);

  const teams = (teamsRes.data ?? []) as Array<{
    auction_user_id: number;
    player_id: string;
    purchase_price: number;
  }>;

  const playerIds = [...new Set(teams.map((t) => String(t.player_id)))];
  let playerById = new Map<string, { player_name: string | null; position: string | null; team_name: string | null }>();

  if (playerIds.length > 0) {
    const playersRes = await admin
      .from("players")
      .select("player_id, player_name, position, team_name")
      .in("player_id", playerIds);
    if (!playersRes.error) {
      playerById = new Map(
        (playersRes.data ?? []).map((p) => [
          String(p.player_id),
          p as { player_name: string | null; position: string | null; team_name: string | null },
        ]),
      );
    }
  }

  const byUser = new Map<number, typeof teams>();
  for (const row of teams) {
    if (!byUser.has(row.auction_user_id)) byUser.set(row.auction_user_id, []);
    byUser.get(row.auction_user_id)!.push(row);
  }

  const scoreMap =
    gameWeekId != null
      ? await fetchPlayerGameweekScores(admin, gameWeekId, playerIds)
      : new Map<string, number>();

  return users
    .filter((u) => byUser.has(u.id))
    .map((u) => ({
      userId: u.id,
      name: u.name ?? "—",
      teamName: u.team_name?.trim() || null,
      totalGwScore: null,
      formation: null,
      players: (byUser.get(u.id) ?? []).map((row) => {
        const meta = playerById.get(String(row.player_id));
        return {
          playerId: String(row.player_id),
          playerName: meta?.player_name ?? null,
          position: meta?.position ?? null,
          club: meta?.team_name ?? null,
          purchasePrice: row.purchase_price,
          score: scoreMap.get(String(row.player_id)) ?? null,
          isBestXi: null,
          xiRole: null,
        };
      }),
    }));
}

/** Gameweeks with a locked squad snapshot for this auction, in chronological order. */
export async function getLockedGameWeeksForAuction(auctionId: number): Promise<GwInfo[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("gameweek_squads")
    .select("game_week_id")
    .eq("auction_id", auctionId);
  if (error) throw new Error(`gameweek_squads: ${error.message}`);

  const gwIds = [...new Set((data ?? []).map((r) => Number(r.game_week_id)))].sort(
    (a, b) => a - b,
  );
  if (!gwIds.length) return [];

  const gwRes = await admin
    .from("Game_Weeks")
    .select("id, GW_Name")
    .in("id", gwIds)
    .order("id", { ascending: true });
  if (gwRes.error) throw new Error(`Game_Weeks: ${gwRes.error.message}`);

  return (gwRes.data ?? []).map((r) => ({
    id: r.id as number,
    name: r.GW_Name as string,
  }));
}

/**
 * Locked snapshot for one GW, or live auction_teams fallback for the active GW
 * after its hard deadline if no snapshot exists yet.
 */
export async function resolveGameweekPanel(
  auctionId: number,
  gw: GwInfo,
  opts: { hardDeadlinePassed: boolean; isActiveGw: boolean },
): Promise<GameweekPanel> {
  const locked = await getGameweekSquadData(auctionId, gw.id);
  if (locked != null && locked.length > 0) {
    return { gw, squads: locked, squadsAreLocked: true };
  }

  if (opts.isActiveGw && opts.hardDeadlinePassed) {
    const current = await getCurrentSquads(auctionId, gw.id);
    return {
      gw,
      squads: current.length > 0 ? current : null,
      squadsAreLocked: false,
    };
  }

  return { gw, squads: null, squadsAreLocked: false };
}

/** Active gameweek from Game_Weeks where Is_Active = true. */
export async function getActiveGameWeek(): Promise<GwInfo | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("Game_Weeks")
    .select("id, GW_Name")
    .eq("Is_Active", true)
    .maybeSingle();
  if (error) throw new Error(`Game_Weeks: ${error.message}`);
  if (!data) return null;
  return { id: data.id as number, name: data.GW_Name as string };
}

/** Locked gameweek_squads rows for one auction/GW. */
type RawSquadRow = {
  auction_user_id: number;
  player_id: string;
  purchase_price: number;
  is_best_xi: boolean | null;
  xi_role?: string | null;
};

async function fetchGameweekSquadRows(
  admin: ReturnType<typeof createAdminClient>,
  auctionId: number,
  gameWeekId: number,
): Promise<RawSquadRow[]> {
  const withXiRole = await admin
    .from("gameweek_squads")
    .select("auction_user_id, player_id, purchase_price, is_best_xi, xi_role")
    .eq("auction_id", auctionId)
    .eq("game_week_id", gameWeekId);

  if (!withXiRole.error) return (withXiRole.data ?? []) as RawSquadRow[];

  if (String(withXiRole.error.message).includes("xi_role")) {
    const withoutXiRole = await admin
      .from("gameweek_squads")
      .select("auction_user_id, player_id, purchase_price, is_best_xi")
      .eq("auction_id", auctionId)
      .eq("game_week_id", gameWeekId);
    if (withoutXiRole.error) throw new Error(`gameweek_squads: ${withoutXiRole.error.message}`);
    return (withoutXiRole.data ?? []).map((row) => ({ ...row, xi_role: null }));
  }

  throw new Error(`gameweek_squads: ${withXiRole.error.message}`);
}

/**
 * Locked squad snapshots for one gameweek, enriched with player metadata
 * and individual scores from Player_Scores (auction-agnostic).
 * Returns null if no squads have been locked for this GW yet.
 */
export async function getGameweekSquadData(
  auctionId: number,
  gameWeekId: number,
): Promise<ParticipantGwSquad[] | null> {
  const admin = createAdminClient();

  const [users, squads, lbRes] = await Promise.all([
    fetchAuctionUserNames(admin, auctionId),
    fetchGameweekSquadRows(admin, auctionId, gameWeekId),
    admin
      .from("auction_leaderboard")
      .select("auction_user_id, total_score")
      .eq("auction_id", auctionId)
      .eq("game_week_id", gameWeekId),
  ]);

  if (lbRes.error) throw new Error(`auction_leaderboard: ${lbRes.error.message}`);

  if (squads.length === 0) return null;
  const lbRows = lbRes.data ?? [];

  // Fetch player metadata
  const playerIds = [...new Set(squads.map((s) => String(s.player_id)))];
  const playersRes = await admin
    .from("players")
    .select("player_id, player_name, position, team_name")
    .in("player_id", playerIds);
  if (playersRes.error) throw new Error(`players: ${playersRes.error.message}`);

  const playerById = new Map(
    (playersRes.data ?? []).map((p) => [
      String(p.player_id),
      p as { player_name: string | null; position: string | null; team_name: string | null },
    ]),
  );

  const scoreMap = await fetchPlayerGameweekScores(admin, gameWeekId, playerIds);

  // Build total GW score lookup
  const totalScoreByUser = new Map<number, number>(
    (lbRows as Array<{ auction_user_id: number; total_score: number }>).map((r) => [
      r.auction_user_id,
      Number(r.total_score),
    ]),
  );

  // Build user name lookup
  const nameById = new Map(users.map((u) => [u.id, u.name ?? "—"]));
  const teamNameById = new Map(users.map((u) => [u.id, u.team_name?.trim() || null]));

  // Group squad rows by user
  const byUser = new Map<number, RawSquadRow[]>();
  for (const row of squads) {
    if (!byUser.has(row.auction_user_id)) byUser.set(row.auction_user_id, []);
    byUser.get(row.auction_user_id)!.push(row);
  }

  // Build result — preserve user order
  const result: ParticipantGwSquad[] = [];
  for (const user of users) {
    const rows = byUser.get(user.id);
    if (!rows) continue;

    const players: GwSquadPlayer[] = rows.map((row) => {
      const meta = playerById.get(String(row.player_id));
      const dbXiRole = row.is_best_xi ? parseXiRole(row.xi_role) : null;
      return {
        playerId: String(row.player_id),
        playerName: meta?.player_name ?? null,
        position: meta?.position ?? null,
        club: meta?.team_name ?? null,
        purchasePrice: row.purchase_price,
        score: scoreMap.get(String(row.player_id)) ?? null,
        isBestXi: row.is_best_xi ?? null,
        xiRole: dbXiRole,
      };
    });

    result.push({
      userId: user.id,
      name: nameById.get(user.id) ?? "—",
      teamName: teamNameById.get(user.id) ?? null,
      players,
      totalGwScore: totalScoreByUser.get(user.id) ?? null,
      formation: null,
    });
  }

  const overlay = loadBestXiOverlay(auctionId, gameWeekId);
  if (overlay) {
    for (const squad of result) {
      squad.formation = overlay.formationByUser.get(squad.userId) ?? null;
      for (const p of squad.players) {
        if (!p.isBestXi) continue;
        const overlayRole = overlay.xiRoleByUserPlayer.get(`${squad.userId}:${p.playerId}`) ?? null;
        if (overlayRole) p.xiRole = overlayRole;
      }
    }
  }

  return result;
}
