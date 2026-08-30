import type { SupabaseClient } from "@supabase/supabase-js";

const PLAYER_ID_BATCH_SIZE = 200;

export type PlayerMetaRow = {
  player_name: string | null;
  position: string | null;
  club: string | null;
};

/** Competition-scoped auctions use competition_players; legacy auctions use global players. */
export async function fetchPlayersByIds(
  admin: SupabaseClient,
  playerIds: string[],
  competitionId: number | null = null,
): Promise<Record<string, unknown>[]> {
  if (!playerIds.length) return [];

  const all: Record<string, unknown>[] = [];

  // Competition-scoped auctions must use competition_players only — the global
  // players table is EPL-centric and mislabels UCL lots (same FotMob id, wrong club).
  if (competitionId != null) {
    for (let i = 0; i < playerIds.length; i += PLAYER_ID_BATCH_SIZE) {
      const batch = playerIds.slice(i, i + PLAYER_ID_BATCH_SIZE).map((id) => {
        const n = Number(id);
        if (!Number.isFinite(n)) throw new Error(`Invalid player_id: ${id}`);
        return n;
      });
      const cpRes = await admin
        .from("competition_players")
        .select("player_id, player_name, position, team_name, team_id")
        .eq("competition_id", competitionId)
        .in("player_id", batch);
      if (cpRes.error) throw new Error(`competition_players: ${cpRes.error.message}`);
      for (const p of cpRes.data ?? []) {
        all.push(p as Record<string, unknown>);
      }
    }
    return all;
  }

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
      for (const p of basic.data ?? []) {
        all.push(p as Record<string, unknown>);
      }
    } else {
      for (const p of withClub.data ?? []) {
        all.push(p as Record<string, unknown>);
      }
    }
  }

  return all;
}

export function playerMetaByIdFromRows(
  rows: Record<string, unknown>[],
): Record<string, PlayerMetaRow> {
  const playerMeta: Record<string, PlayerMetaRow> = {};
  for (const p of rows) {
    const row = p as {
      player_id: string | number;
      player_name: string | null;
      position: string | null;
      team_name?: string | null;
    };
    playerMeta[String(row.player_id)] = {
      player_name: row.player_name,
      position: row.position,
      club: row.team_name ?? null,
    };
  }
  return playerMeta;
}

export async function fetchPlayerMetaByIds(
  admin: SupabaseClient,
  playerIds: string[],
  competitionId: number | null = null,
): Promise<Record<string, PlayerMetaRow>> {
  const rows = await fetchPlayersByIds(admin, playerIds, competitionId);
  return playerMetaByIdFromRows(rows);
}

export function resolveAuctionCompetitionId(
  auction: { competition_id?: number | null } | null | undefined,
): number | null {
  return auction?.competition_id != null && Number.isFinite(Number(auction.competition_id))
    ? Number(auction.competition_id)
    : null;
}
