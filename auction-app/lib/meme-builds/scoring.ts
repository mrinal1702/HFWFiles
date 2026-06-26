import type { MemeBuild, MemeBuildScoreMap } from "@/lib/meme-builds/types";

export type MemeBuildStandingRow = {
  buildId: string;
  name: string;
  scoresByGwId: Record<string, number>;
  total: number;
  rank: number;
};

export function scoreForPlayer(
  scoreMap: MemeBuildScoreMap,
  gameWeekId: number,
  playerId: string,
): number {
  return scoreMap[String(gameWeekId)]?.[playerId] ?? 0;
}

export function computeBuildGwTotal(
  build: MemeBuild,
  gameWeekId: number,
  scoreMap: MemeBuildScoreMap,
): number {
  let total = 0;
  for (const p of build.players) {
    if (!p.inXi) continue;
    total += scoreForPlayer(scoreMap, gameWeekId, p.playerId);
  }
  return total;
}

export function computeStandings(
  builds: MemeBuild[],
  gameWeekIds: number[],
  scoreMap: MemeBuildScoreMap,
): MemeBuildStandingRow[] {
  const unsorted = builds.map((build) => {
    const scoresByGwId: Record<string, number> = {};
    let total = 0;
    for (const gwId of gameWeekIds) {
      const gwScore = computeBuildGwTotal(build, gwId, scoreMap);
      scoresByGwId[String(gwId)] = gwScore;
      total += gwScore;
    }
    return { buildId: build.id, name: build.name, scoresByGwId, total, rank: 0 };
  });

  unsorted.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return unsorted.map((row, idx) => ({ ...row, rank: idx + 1 }));
}
