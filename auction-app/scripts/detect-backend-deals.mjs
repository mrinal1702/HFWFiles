/**
 * Detect back-end (manual transfer) deals in an auction, so the correct
 * elimination release can be applied.
 *
 * Rule (per commissioner): elimination release = half (round-half-up) of the
 * ORIGINAL AUCTION price, NOT the private back-end deal price recorded on the
 * current owner's squad.
 *
 * A back-end deal is detected when a currently-owned player's current
 * owner/price differs from the earliest snapshot owner/price, and/or the
 * current owner never won the player at their recorded price via a bid.
 *
 * Usage: node scripts/detect-backend-deals.mjs [auctionId=5]
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
for (const l of env.split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const AUCTION = Number(process.argv[2] || 5);
const refundAmount = (p) => Math.floor((p + 1) / 2);

async function pageAll(tbl, cols) {
  let out = [];
  for (let from = 0; ; from += 1000) {
    const r = await s.from(tbl).select(cols).eq("auction_id", AUCTION).range(from, from + 999);
    if (r.error) throw new Error(`${tbl}: ${r.error.message}`);
    out = out.concat(r.data);
    if (r.data.length < 1000) break;
  }
  return out;
}

const [teams, bids, snaps, users, playersOwnedList] = await Promise.all([
  pageAll("auction_teams", "auction_user_id, player_id, purchase_price"),
  pageAll("auction_bids", "auction_user_id, player_id, amount, created_at"),
  pageAll("gameweek_squads", "game_week_id, auction_user_id, player_id, purchase_price"),
  s.from("auction_users").select("id, name, is_relegated").eq("auction_id", AUCTION).then((r) => r.data),
  null,
]);

const uName = (id) => users.find((u) => u.id === id)?.name ?? `user#${id}`;

// player names
const ownedIds = [...new Set(teams.map((t) => String(t.player_id)))];
const playerMap = new Map();
for (let i = 0; i < ownedIds.length; i += 300) {
  const chunk = ownedIds.slice(i, i + 300);
  const { data } = await s.from("players").select("player_id, player_name, team_name").in("player_id", chunk);
  for (const p of data ?? []) playerMap.set(String(p.player_id), p);
}

// index bids & snaps by player
const bidsByPlayer = new Map();
for (const b of bids) {
  const k = String(b.player_id);
  if (!bidsByPlayer.has(k)) bidsByPlayer.set(k, []);
  bidsByPlayer.get(k).push(b);
}
const snapsByPlayer = new Map();
for (const sn of snaps) {
  const k = String(sn.player_id);
  if (!snapsByPlayer.has(k)) snapsByPlayer.set(k, []);
  snapsByPlayer.get(k).push(sn);
}

const deals = [];
for (const t of teams) {
  const pid = String(t.player_id);
  const curOwner = t.auction_user_id;
  const curPrice = t.purchase_price;

  const pbids = (bidsByPlayer.get(pid) ?? []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const psnaps = (snapsByPlayer.get(pid) ?? []).slice().sort((a, b) => a.game_week_id - b.game_week_id);

  const earliest = psnaps[0];
  // signals of a back-end deal
  const ownerChanged = earliest && earliest.auction_user_id !== curOwner;
  const priceChanged = earliest && earliest.purchase_price !== curPrice;
  const wonAtCurrentPrice = pbids.some((b) => b.auction_user_id === curOwner && b.amount === curPrice);
  const looksLikeDeal = (ownerChanged || priceChanged) && !wonAtCurrentPrice;
  if (!looksLikeDeal) continue;

  // auction price = earliest snapshot price (the pre-deal auction value),
  // cross-checked against last real bid
  const auctionPrice = earliest ? earliest.purchase_price : curPrice;
  const lastBid = pbids.length ? pbids[pbids.length - 1] : null;

  deals.push({ pid, curOwner, curPrice, auctionPrice, earliest, lastBid, psnaps });
}

const p = playerMap;
console.log(`\n=== Back-end deal candidates in auction ${AUCTION}: ${deals.length} ===\n`);
for (const d of deals) {
  const info = p.get(d.pid);
  console.log(`${info?.player_name ?? d.pid} (${d.pid}, ${info?.team_name ?? "?"})`);
  console.log(`  current owner: ${uName(d.curOwner)} @ ${d.curPrice}`);
  console.log(`  snapshots: ${d.psnaps.map((x) => `GW${x.game_week_id}:${uName(x.auction_user_id)}@${x.purchase_price}`).join("  ")}`);
  if (d.lastBid) console.log(`  last bid: ${uName(d.lastBid.auction_user_id)} @ ${d.lastBid.amount} (${d.lastBid.created_at})`);
  console.log(`  >> auction price = ${d.auctionPrice}`);
  console.log(`     RELEASE (auction-price rule): ${refundAmount(d.auctionPrice)}   |   engine default (deal price ${d.curPrice}): ${refundAmount(d.curPrice)}`);
  console.log("");
}
console.log("Tip: at each nation elimination, run this to see which owned players need the auction-price release instead of the recorded deal price.");
