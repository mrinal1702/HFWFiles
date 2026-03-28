export const AUCTION_ACTOR_COOKIE = "auction_actor";

/**
 * Maps auction id (string) → auction_users.id, or `null` = explicit view-only for that auction.
 * Missing key → default to first manager in the auction (dev convenience).
 */
export type AuctionActorMap = Record<string, number | null>;

export function parseActorCookie(raw: string | undefined | null): AuctionActorMap {
  if (!raw?.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
    const out: AuctionActorMap = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val === null) {
        out[k] = null;
        continue;
      }
      const n = Number(val);
      if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeActorMap(map: AuctionActorMap): string {
  return JSON.stringify(map);
}

/**
 * Same rules as the auction UI: valid cookie wins; invalid cookie → viewer;
 * no cookie → first user id in the list (dev default).
 */
export function resolveActorFromIds(
  auctionId: number,
  userIds: number[],
  map: AuctionActorMap,
): { actorUserId: number | null; viewerMode: boolean } {
  const valid = new Set(userIds);
  const key = String(auctionId);
  const entry = map[key];

  if (Object.prototype.hasOwnProperty.call(map, key) && entry === null) {
    return { actorUserId: null, viewerMode: true };
  }

  if (typeof entry === "number" && Number.isFinite(entry)) {
    if (valid.has(entry)) {
      return { actorUserId: entry, viewerMode: false };
    }
    return { actorUserId: null, viewerMode: true };
  }

  if (userIds.length > 0) {
    return { actorUserId: userIds[0], viewerMode: false };
  }

  return { actorUserId: null, viewerMode: false };
}
