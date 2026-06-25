export type MatchScoreRow = {
  playerName: string;
  playerId: string;
  teamName: string;
  position: string;
  statsScore: number;
  endowmentScore: number;
  finalScore: number;
};

export type GroupStageGw = 1 | 2 | 3;

export type MatchScoreSheet = {
  slug: string;
  title: string;
  subtitle: string;
  groupStageGw: GroupStageGw;
  rows: MatchScoreRow[];
};

export type MatchScoreGroup = {
  gw: GroupStageGw;
  label: string;
  sheets: MatchScoreSheet[];
};
