import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

export const PENDING_POOL_PATH = path.join(
  repoRoot,
  "Player_List",
  "World Cup 2026",
  "pending_pool_additions.json",
);

const POSITION_MAP = {
  defender: "Defender",
  midfielder: "Midfielder",
  forward: "Forward",
  goalkeeper: "Goalkeeper",
};

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (!q && c === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

let teamIdByNameCache = null;

export function loadTeamIdByName() {
  if (teamIdByNameCache) return teamIdByNameCache;
  const map = new Map();
  const csvPath = path.join(repoRoot, "Player_List", "master_player_list.csv");
  if (!fs.existsSync(csvPath)) {
    teamIdByNameCache = map;
    return map;
  }
  const lines = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const teamNameIdx = headers.indexOf("team_name");
  const teamIdIdx = headers.indexOf("team_id");
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const teamName = cols[teamNameIdx]?.trim();
    const teamId = Number(cols[teamIdIdx]);
    if (teamName && Number.isFinite(teamId) && !map.has(teamName)) {
      map.set(teamName, teamId);
    }
  }
  teamIdByNameCache = map;
  return map;
}

export function loadPendingPoolAdditions() {
  if (!fs.existsSync(PENDING_POOL_PATH)) {
    return { _readme: "", players: [] };
  }
  const data = JSON.parse(fs.readFileSync(PENDING_POOL_PATH, "utf8"));
  return {
    _readme: data._readme ?? "",
    players: Array.isArray(data.players) ? data.players : [],
  };
}

export function savePendingPoolAdditions(data) {
  const dir = path.dirname(PENDING_POOL_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PENDING_POOL_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function matchLabelFromSourceFile(sourceFile) {
  const base = String(sourceFile ?? "").replace(/_FinalPoints\.csv$/i, "");
  if (!base) return null;
  return base.replace(/_/g, " ").replace(/\bVs\b/gi, "vs");
}

function fotmobUrl(playerId, playerName) {
  const slug = String(playerName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug
    ? `https://www.fotmob.com/en-GB/players/${playerId}/${slug}`
    : `https://www.fotmob.com/en-GB/players/${playerId}`;
}

/**
 * Append score-upload rows that are missing from public.players.
 * Skips keeper units and players already on the pending list.
 * Returns newly added entries.
 */
export function mergeMissingIntoPendingPool(missingRows) {
  const today = new Date().toISOString().slice(0, 10);
  const teamIds = loadTeamIdByName();
  const store = loadPendingPoolAdditions();
  const existing = new Set(store.players.map((p) => Number(p.player_id)));
  const added = [];

  for (const row of missingRows) {
    if (row.is_keeper_unit) continue;
    const playerId = Number(row.player_id);
    if (!Number.isFinite(playerId) || existing.has(playerId)) continue;

    const positionKey = String(row.position ?? "").toLowerCase();
    const entry = {
      player_id: playerId,
      player_name: row.player_name,
      team_id: teamIds.get(row.team_name) ?? null,
      team_name: row.team_name,
      position: POSITION_MAP[positionKey] ?? row.position ?? null,
      fotmob_url: fotmobUrl(playerId, row.player_name),
      reason: "late_callup",
      first_seen: today,
      first_seen_match: matchLabelFromSourceFile(row.source_file),
      notes: "Auto-added from upsert:player-scores (not in public.players).",
    };
    store.players.push(entry);
    existing.add(playerId);
    added.push(entry);
  }

  if (added.length) {
    store.players.sort((a, b) => a.player_name.localeCompare(b.player_name));
    savePendingPoolAdditions(store);
  }

  return added;
}
