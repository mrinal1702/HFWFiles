/** Fantasy team label for UI; falls back to participant name when unset. */
export function fantasyTeamLabel(
  teamName: string | null | undefined,
  participantName: string | null | undefined,
): string {
  const team = teamName?.trim();
  if (team) return team;
  return participantName?.trim() || "—";
}

export const FANTASY_TEAM_NAME_MAX_LENGTH = 48;
