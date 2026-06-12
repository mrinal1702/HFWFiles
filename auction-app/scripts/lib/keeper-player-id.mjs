/** Matches build_wc_master_player_csv.py: synthetic keeper bundle IDs in players table. */
export const KEEPER_SYNTHETIC_OFFSET = 90_000_000;

export function isKeeperUnitRow({ player_name, position }) {
  const name = String(player_name ?? "").trim();
  const pos = String(position ?? "").trim().toLowerCase();
  return pos === "goalkeeper" || name.endsWith(" Keepers");
}

/**
 * FinalPoints keeper rows use team_id as player_id.
 * Auction players table uses 90_000_000 + team_id for keeper bundles.
 */
export function resolveScorePlayerId({ player_id, player_name, position }) {
  const rawId = Number(player_id);
  if (!Number.isFinite(rawId)) return rawId;
  if (!isKeeperUnitRow({ player_name, position })) return rawId;
  return KEEPER_SYNTHETIC_OFFSET + rawId;
}
