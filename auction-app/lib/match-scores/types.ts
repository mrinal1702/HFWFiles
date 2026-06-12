export type MatchScoreRow = {
  playerName: string;
  playerId: string;
  teamName: string;
  position: string;
  statsScore: number;
  endowmentScore: number;
  finalScore: number;
};

export type MatchScoreSheet = {
  slug: string;
  title: string;
  subtitle: string;
  rows: MatchScoreRow[];
};
