/** Role assigned in the manager's Best XI formation (scoring slot). */
export type XiRole = "GK" | "D" | "M" | "F";

export type XiSortPlayer = {
  xiRole: XiRole | null;
  playerId: string;
  position: string | null;
  score: number | null;
};

const KEEPER_UNIT_ID_MIN = 90_000_000;

export function parseXiRole(raw: string | null | undefined): XiRole | null {
  const r = (raw ?? "").trim().toUpperCase();
  if (r === "GK") return "GK";
  if (r === "D" || r === "DEF") return "D";
  if (r === "M" || r === "MID") return "M";
  if (r === "F" || r === "FWD") return "F";
  return null;
}

export function isKeeperUnitPlayerId(playerId: string | null | undefined): boolean {
  const n = Number(playerId);
  return Number.isFinite(n) && n >= KEEPER_UNIT_ID_MIN;
}

/** Listed pool position → formation-line sort order when XI slot role is unknown. */
export function listedPositionSortKey(position: string | null | undefined): number {
  const label = formatListedPosition(position);
  if (label === "GK") return 0;
  if (label === "DEF") return 1;
  if (label === "MID") return 2;
  if (label === "FWD") return 3;
  return 9;
}

/** Role used for XI display sort: formation slot first, then GK unit / listed position. */
export function xiDisplaySortKey(player: XiSortPlayer): number {
  if (player.xiRole) return xiRoleSortKey(player.xiRole);
  if (isKeeperUnitPlayerId(player.playerId)) return 0;
  return listedPositionSortKey(player.position);
}

/** GK → DEF → MID → FWD; within a line, higher score first. */
export function compareXiPlayersForDisplay(a: XiSortPlayer, b: XiSortPlayer): number {
  const ra = xiDisplaySortKey(a);
  const rb = xiDisplaySortKey(b);
  if (ra !== rb) return ra - rb;
  return (b.score ?? 0) - (a.score ?? 0);
}

export function xiRoleSortKey(role: XiRole | null | undefined): number {
  switch (role) {
    case "GK":
      return 0;
    case "D":
      return 1;
    case "M":
      return 2;
    case "F":
      return 3;
    default:
      return 9;
  }
}

export function formatXiRoleLabel(role: XiRole): string {
  switch (role) {
    case "GK":
      return "GK";
    case "D":
      return "DEF";
    case "M":
      return "MID";
    case "F":
      return "FWD";
  }
}

/** Short label for listed pool position (bench / fallback). */
export function formatListedPosition(position: string | null | undefined): string | null {
  const p = (position ?? "").trim().toLowerCase();
  if (!p) return null;
  if (p.includes("goalkeeper")) return "GK";
  if (p.includes("defend")) return "DEF";
  if (p.includes("midfield")) return "MID";
  if (p.includes("forward")) return "FWD";
  return position!.trim();
}
