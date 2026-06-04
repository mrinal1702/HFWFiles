import { createAdminClient } from "@/lib/supabase-server";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type GwInfo = {
  id: number;
  name: string;
};

export type StandingEntry = {
  userId: number;
  name: string;
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
};

export type ParticipantGwSquad = {
  userId: number;
  name: string;
  players: GwSquadPlayer[];
  /** Total GW score from auction_leaderboard; null if scores not yet published */
  totalGwScore: number | null;
};

export type LeaderboardData = {
  standings: StandingEntry[];
  gameWeeks: GwInfo[];
};

// ─── Loaders ─────────────────────────────────────────────────────────────────

/** All-GW standings for the Standings tab. */
export async function getLeaderboardData(auctionId: number): Promise<LeaderboardData> {
  const admin = createAdminClient();

  const [usersRes, lbRes] = await Promise.all([
    admin
      .from("auction_users")
      .select("id, name")
      .eq("auction_id", auctionId)
      .order("id", { ascending: true }),
    admin
      .from("auction_leaderboard")
      .select("auction_user_id, game_week_id, total_score")
      .eq("auction_id", auctionId),
  ]);

  if (usersRes.error) throw new Error(`auction_users: ${usersRes.error.message}`);
  if (lbRes.error) throw new Error(`auction_leaderboard: ${lbRes.error.message}`);

  const users = (usersRes.data ?? []) as Array<{ id: number; name: string | null }>;
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
    return { userId: u.id, name: u.name ?? "—", scoresByGwId: gwScores, total };
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

/**
 * Locked squad snapshots for one gameweek, enriched with player metadata
 * and individual scores from auction_score_breakdown.
 * Returns null if no squads have been locked for this GW yet.
 */
export async function getGameweekSquadData(
  auctionId: number,
  gameWeekId: number,
): Promise<ParticipantGwSquad[] | null> {
  const admin = createAdminClient();

  const [usersRes, squadsRes, scoresRes, lbRes] = await Promise.all([
    admin
      .from("auction_users")
      .select("id, name")
      .eq("auction_id", auctionId)
      .order("id", { ascending: true }),
    admin
      .from("gameweek_squads")
      .select("auction_user_id, player_id, purchase_price, is_best_xi")
      .eq("auction_id", auctionId)
      .eq("game_week_id", gameWeekId),
    admin
      .from("auction_score_breakdown")
      .select("auction_user_id, player_id, score")
      .eq("auction_id", auctionId)
      .eq("game_week_id", gameWeekId),
    admin
      .from("auction_leaderboard")
      .select("auction_user_id, total_score")
      .eq("auction_id", auctionId)
      .eq("game_week_id", gameWeekId),
  ]);

  if (usersRes.error) throw new Error(`auction_users: ${usersRes.error.message}`);
  if (squadsRes.error) throw new Error(`gameweek_squads: ${squadsRes.error.message}`);
  if (scoresRes.error) throw new Error(`auction_score_breakdown: ${scoresRes.error.message}`);
  if (lbRes.error) throw new Error(`auction_leaderboard: ${lbRes.error.message}`);

  const squads = squadsRes.data ?? [];
  if (squads.length === 0) return null;

  const users = (usersRes.data ?? []) as Array<{ id: number; name: string | null }>;
  const scores = scoresRes.data ?? [];
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

  // Build score lookup: "userId:playerId" → score
  const scoreKey = (userId: number, playerId: string) => `${userId}:${playerId}`;
  const scoreMap = new Map<string, number>();
  for (const s of scores) {
    scoreMap.set(scoreKey(s.auction_user_id as number, String(s.player_id)), Number(s.score));
  }

  // Build total GW score lookup
  const totalScoreByUser = new Map<number, number>(
    (lbRows as Array<{ auction_user_id: number; total_score: number }>).map((r) => [
      r.auction_user_id,
      Number(r.total_score),
    ]),
  );

  // Build user name lookup
  const nameById = new Map(users.map((u) => [u.id, u.name ?? "—"]));

  // Group squad rows by user
  type RawSquadRow = {
    auction_user_id: number;
    player_id: string;
    purchase_price: number;
    is_best_xi: boolean | null;
  };
  const byUser = new Map<number, RawSquadRow[]>();
  for (const row of squads as RawSquadRow[]) {
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
      return {
        playerId: String(row.player_id),
        playerName: meta?.player_name ?? null,
        position: meta?.position ?? null,
        club: meta?.team_name ?? null,
        purchasePrice: row.purchase_price,
        score: scoreMap.get(scoreKey(row.auction_user_id, String(row.player_id))) ?? null,
        isBestXi: row.is_best_xi ?? null,
      };
    });

    result.push({
      userId: user.id,
      name: nameById.get(user.id) ?? "—",
      players,
      totalGwScore: totalScoreByUser.get(user.id) ?? null,
    });
  }

  return result;
}
