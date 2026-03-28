import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(appRoot, "..");

const START_BUDGET = 350;
const PLAYER_PRICE = 15;
const USERS_COUNT = 8;
const PLAYERS_PER_USER = 18;
const PLAYER_POOL_SIZE = USERS_COUNT * PLAYERS_PER_USER;
const TARGET_GW_NAME = "UCL QF Leg 1";
const TARGET_AUCTION_NAME = "test_simulation_auction";

function loadEnvLocal() {
  const envPath = path.join(appRoot, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",");
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = (cols[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

function randomId(rng, prefix) {
  const n = Math.floor(rng() * 1_000_000_000);
  return `${prefix}_${n.toString(36)}`;
}

function normalizePosition(raw) {
  const p = String(raw || "").trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper") return "GK";
  return p;
}

function normalizeTeam(raw) {
  return String(raw || "").trim();
}

async function ensureGameWeek(supabase) {
  const found = await supabase
    .from("Game_Weeks")
    .select("id,GW_Name,Is_Active")
    .eq("GW_Name", TARGET_GW_NAME)
    .maybeSingle();
  if (found.error) throw new Error(`Game week lookup failed: ${found.error.message}`);
  if (found.data) return found.data;

  const nextIdRes = await supabase
    .from("Game_Weeks")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (nextIdRes.error) throw new Error(`Game week id lookup failed: ${nextIdRes.error.message}`);
  const nextId = Number(nextIdRes.data?.id || 0) + 1;

  const ins = await supabase
    .from("Game_Weeks")
    .insert({ id: nextId, GW_Name: TARGET_GW_NAME, Is_Active: false })
    .select("id,GW_Name,Is_Active")
    .single();
  if (ins.error) throw new Error(`Game week insert failed: ${ins.error.message}`);
  return ins.data;
}

async function ensureAuction(supabase) {
  const found = await supabase
    .from("Auctions")
    .select("id,name,is_active")
    .eq("name", TARGET_AUCTION_NAME)
    .maybeSingle();
  if (found.error) throw new Error(`Auction lookup failed: ${found.error.message}`);
  if (found.data) return found.data;

  const nextIdRes = await supabase
    .from("Auctions")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (nextIdRes.error) throw new Error(`Auction id lookup failed: ${nextIdRes.error.message}`);
  const nextId = Number(nextIdRes.data?.id || 0) + 1;

  const ins = await supabase
    .from("Auctions")
    .insert({ id: nextId, name: TARGET_AUCTION_NAME, is_active: false })
    .select("id,name,is_active")
    .single();
  if (ins.error) throw new Error(`Auction insert failed: ${ins.error.message}`);
  return ins.data;
}

async function createAuctionUsers(supabase, auctionId, rng) {
  const firstNames = ["Aarav", "Kabir", "Nikhil", "Rohan", "Arjun", "Vihaan", "Ishan", "Dev"];
  const lastNames = ["Sharma", "Mehta", "Kapoor", "Patel", "Nair", "Rao", "Bose", "Malhotra"];

  const users = Array.from({ length: USERS_COUNT }, (_, i) => {
    const first = firstNames[i % firstNames.length];
    const last = lastNames[Math.floor(rng() * lastNames.length)];
    return {
      auction_id: auctionId,
      name: `${first} ${last}`,
      budget_remaining: START_BUDGET,
      active_budget: START_BUDGET,
    };
  });

  const ins = await supabase
    .from("auction_users")
    .insert(users)
    .select("id,name,budget_remaining,active_budget");
  if (ins.error) throw new Error(`auction_users insert failed: ${ins.error.message}`);
  return ins.data || [];
}

function buildTeamsPayload(auctionId, auctionUsers, playerPool, gkPool, rng) {
  if (auctionUsers.length !== USERS_COUNT) {
    throw new Error(`Expected ${USERS_COUNT} auction users, got ${auctionUsers.length}.`);
  }

  const gkByTeam = new Map();
  for (const p of gkPool) {
    if (!gkByTeam.has(p.team_name)) gkByTeam.set(p.team_name, []);
    gkByTeam.get(p.team_name).push(p);
  }

  if (gkByTeam.size < USERS_COUNT) {
    throw new Error(
      `Need at least ${USERS_COUNT} unique GK teams. Found ${gkByTeam.size} unique teams.`,
    );
  }

  const uniqueTeams = [...gkByTeam.keys()];
  shuffleInPlace(uniqueTeams, rng);
  const selectedGkTeams = uniqueTeams.slice(0, USERS_COUNT);

  const gkAssignments = selectedGkTeams.map((team) => {
    const candidates = [...(gkByTeam.get(team) || [])];
    shuffleInPlace(candidates, rng);
    return candidates[0];
  });

  const nonGkPool = playerPool.filter((p) => normalizePosition(p.position) !== "GK");
  shuffleInPlace(nonGkPool, rng);

  const requiredNonGk = USERS_COUNT * (PLAYERS_PER_USER - 1);
  if (nonGkPool.length < requiredNonGk) {
    throw new Error(
      `Need ${requiredNonGk} non-GK players but found ${nonGkPool.length} in player list.`,
    );
  }

  const payload = [];
  let offset = 0;
  for (let i = 0; i < auctionUsers.length; i += 1) {
    const user = auctionUsers[i];
    const playersForUser = [gkAssignments[i], ...nonGkPool.slice(offset, offset + (PLAYERS_PER_USER - 1))];
    offset += PLAYERS_PER_USER - 1;

    playersForUser.forEach((p) => {
      payload.push({
        auction_id: auctionId,
        auction_user_id: user.id,
        player_id: String(p.player_id),
        purchase_price: PLAYER_PRICE,
      });
    });
  }

  return payload;
}

async function insertAuctionTeams(supabase, payload) {
  const ins = await supabase.from("auction_teams").insert(payload);
  if (ins.error) throw new Error(`auction_teams insert failed: ${ins.error.message}`);
}

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Need NEXT_PUBLIC_SUPABASE_URL and key (prefer SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  const csvPath = path.join(workspaceRoot, "Player_List", "master_player_list.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Player list not found at ${csvPath}`);
  }

  const seed = Number(process.argv[2] || Date.now());
  const rng = mulberry32(Number.isFinite(seed) ? seed : Date.now());

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""));
  const playerPool = rows
    .map((r) => ({
      player_id: String(r.player_id || ""),
      player_name: String(r.player_name || ""),
      position: normalizePosition(r.position),
      team_name: normalizeTeam(r.team_name),
    }))
    .filter((r) => r.player_id && r.team_name && r.position);

  if (playerPool.length < PLAYER_POOL_SIZE) {
    throw new Error(
      `Need at least ${PLAYER_POOL_SIZE} players in source list; found ${playerPool.length}.`,
    );
  }

  const gkPool = playerPool.filter((r) => r.position === "GK");
  if (gkPool.length < USERS_COUNT) {
    throw new Error(`Need at least ${USERS_COUNT} goalkeepers; found ${gkPool.length}.`);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const gameWeek = await ensureGameWeek(supabase);
  const auction = await ensureAuction(supabase);

  const usersResult = await createAuctionUsers(supabase, auction.id, rng);
  const teamsPayload = buildTeamsPayload(auction.id, usersResult, playerPool, gkPool, rng);
  await insertAuctionTeams(supabase, teamsPayload);

  const spentPerUser = PLAYERS_PER_USER * PLAYER_PRICE;
  const expectedRemaining = START_BUDGET - spentPerUser;
  const updateUsers = await supabase
    .from("auction_users")
    .update({ budget_remaining: expectedRemaining, active_budget: expectedRemaining })
    .eq("auction_id", auction.id)
    .in(
      "id",
      usersResult.map((u) => u.id),
    );
  if (updateUsers.error) {
    throw new Error(`auction_users budget update failed: ${updateUsers.error.message}`);
  }

  console.log(`Created/verified game week: ${gameWeek.GW_Name} (id=${gameWeek.id})`);
  console.log(`Created/verified auction: ${auction.name} (id=${auction.id})`);
  console.log(`Inserted auction_users: ${usersResult.length}`);
  console.log(`Inserted auction_teams rows: ${teamsPayload.length}`);
  console.log(`Each user assigned ${PLAYERS_PER_USER} players at ${PLAYER_PRICE}M each.`);
  console.log(`Budget per user updated to budget_remaining=${expectedRemaining}, active_budget=${expectedRemaining}.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
