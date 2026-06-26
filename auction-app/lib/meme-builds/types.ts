/** A player in a meme build squad with manual Starting XI flag. */
export type MemeBuildSquadPlayer = {
  playerId: string;
  inXi: boolean;
};

export type MemeBuild = {
  id: string;
  name: string;
  players: MemeBuildSquadPlayer[];
  createdAt: string;
  updatedAt: string;
};

export type MemeBuildPoolPlayer = {
  playerId: string;
  playerName: string | null;
  position: string | null;
  country: string | null;
};

export type MemeBuildGwInfo = {
  id: number;
  name: string;
};

/** gameWeekId → playerId → score */
export type MemeBuildScoreMap = Record<string, Record<string, number>>;

/** gameWeekId → playerId → match position */
export type MemeBuildMatchPosMap = Record<string, Record<string, string>>;

export const MAX_STARTING_XI = 11;

export const MEME_BUILD_GAME_WEEK_IDS = [1, 2, 3] as const;
