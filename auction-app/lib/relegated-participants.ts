import "server-only";

import fs from "node:fs";
import path from "node:path";

let cached: Map<number, Set<number>> | null = null;

function loadFromJson(): Map<number, Set<number>> {
  const filePath = path.join(process.cwd(), "data", "relegated-participants.json");
  const map = new Map<number, Set<number>>();
  if (!fs.existsSync(filePath)) return map;

  let parsed: Record<string, number[]>;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, number[]>;
  } catch {
    return map;
  }

  for (const [auctionIdStr, userIds] of Object.entries(parsed)) {
    const auctionId = Number(auctionIdStr);
    if (!Number.isFinite(auctionId)) continue;
    map.set(auctionId, new Set((userIds ?? []).map(Number).filter(Number.isFinite)));
  }
  return map;
}

export function relegatedUserIdsForAuction(auctionId: number): Set<number> {
  if (!cached) cached = loadFromJson();
  return cached.get(auctionId) ?? new Set();
}

export function isUserRelegated(
  auctionId: number,
  userId: number,
  dbFlag?: boolean | null,
): boolean {
  if (dbFlag === true) return true;
  return relegatedUserIdsForAuction(auctionId).has(userId);
}

export const RELEGATION_ACTION_MESSAGE =
  "You have been relegated and can no longer bid, transfer, release players, or manage a squad.";
