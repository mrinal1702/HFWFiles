export type MatchScoreRow = {
  playerName: string;
  playerId: string;
  teamName: string;
  position: string;
  statsScore: number;
  endowmentScore: number;
  finalScore: number;
};

export type GroupStageGw = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type MatchScoreSheet = {
  slug: string;
  title: string;
  subtitle: string;
  groupStageGw: GroupStageGw;
  /** Competition this match belongs to, e.g. "epl-2026-27". */
  competitionSlug?: string;
  /** FotMob match ID for historical traceability. */
  fotmobMatchId?: number;
  rows: MatchScoreRow[];
};

export type MatchScoreGroup = {
  gw: GroupStageGw;
  label: string;
  sheets: MatchScoreSheet[];
};
