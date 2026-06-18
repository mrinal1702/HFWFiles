/** Role assigned in the manager's Best XI formation (scoring slot). */
export type XiRole = "GK" | "D" | "M" | "F";

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
