import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { XiRole } from "@/lib/best-xi-display";

export type { XiRole } from "@/lib/best-xi-display";

type BestXiJsonManager = {
  auction_user_id: string;
  formation: string;
  goalkeeper: { player_id: number | null };
  outfield: Array<{ player_id: number; role: string }>;
};

type BestXiJson = {
  managers: BestXiJsonManager[];
};

export type BestXiOverlay = {
  formationByUser: Map<number, string>;
  /** `${auctionUserId}:${playerId}` → formation slot role */
  xiRoleByUserPlayer: Map<string, XiRole>;
};

const VALID_ROLES = new Set<XiRole>(["GK", "D", "M", "F"]);

function toXiRole(raw: string | null | undefined): XiRole | null {
  const r = (raw ?? "").trim().toUpperCase();
  if (r === "GK") return "GK";
  if (VALID_ROLES.has(r as XiRole)) return r as XiRole;
  return null;
}

/**
 * Display-only overlay from published Best XI JSON (formation + XI slot per player).
 * Does not affect scores — metadata for the leaderboard UI only.
 */
export function loadBestXiOverlay(auctionId: number, gameWeekId: number): BestXiOverlay | null {
  const filePath = path.join(
    process.cwd(),
    "data",
    "best-xi",
    `auction-${auctionId}-gw${gameWeekId}.json`,
  );
  if (!fs.existsSync(filePath)) return null;

  let parsed: BestXiJson;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as BestXiJson;
  } catch {
    return null;
  }

  const formationByUser = new Map<number, string>();
  const xiRoleByUserPlayer = new Map<string, XiRole>();

  for (const m of parsed.managers ?? []) {
    const uid = Number(m.auction_user_id);
    if (!Number.isFinite(uid)) continue;
    if (m.formation) formationByUser.set(uid, m.formation);

    const gkId = m.goalkeeper?.player_id;
    if (gkId != null) {
      xiRoleByUserPlayer.set(`${uid}:${gkId}`, "GK");
    }
    for (const o of m.outfield ?? []) {
      const role = toXiRole(o.role);
      if (role && role !== "GK") {
        xiRoleByUserPlayer.set(`${uid}:${o.player_id}`, role);
      }
    }
  }

  return { formationByUser, xiRoleByUserPlayer };
}
