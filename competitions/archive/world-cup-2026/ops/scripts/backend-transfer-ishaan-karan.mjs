/**
 * Backend transfer — auction 6
 * Ishaan Shah → Karan Vira: Dani Olmo
 * Karan Vira → Ishaan Shah: Denis Zakaria
 * purchase_price preserved for release/elimination basis.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
for (const l of env.split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const AUCTION = 6;
const ISHAAN = 53;
const KARAN = 62;
const OLMO = "614834";
const ZAKARIA = "598355";

async function getTeam(playerId, ownerId) {
  const { data, error } = await s
    .from("auction_teams")
    .select("purchase_price")
    .eq("auction_id", AUCTION)
    .eq("player_id", playerId)
    .eq("auction_user_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const [olmo, zak] = await Promise.all([getTeam(OLMO, ISHAAN), getTeam(ZAKARIA, KARAN)]);
if (!olmo) throw new Error("Dani Olmo not owned by Ishaan Shah");
if (!zak) throw new Error("Denis Zakaria not owned by Karan Vira");

console.log(`Olmo @ ${olmo.purchase_price} → Karan`);
console.log(`Zakaria @ ${zak.purchase_price} → Ishaan`);

const { error: e1 } = await s
  .from("auction_teams")
  .update({ auction_user_id: KARAN })
  .eq("auction_id", AUCTION)
  .eq("player_id", OLMO)
  .eq("auction_user_id", ISHAAN);
if (e1) throw e1;

const { error: e2 } = await s
  .from("auction_teams")
  .update({ auction_user_id: ISHAAN })
  .eq("auction_id", AUCTION)
  .eq("player_id", ZAKARIA)
  .eq("auction_user_id", KARAN);
if (e2) throw e2;

const u = await s.from("auction_users").select("id,name").eq("auction_id", AUCTION);
const name = (id) => u.data.find((x) => x.id === id)?.name;
const refund = (p) => Math.floor((p + 1) / 2);

const [olmoV, zakV] = await Promise.all([getTeam(OLMO, KARAN), getTeam(ZAKARIA, ISHAAN)]);
console.log("\nDone:");
console.log(`  Dani Olmo → ${name(KARAN)} @ ${olmoV.purchase_price} (release ${refund(olmoV.purchase_price)})`);
console.log(`  Denis Zakaria → ${name(ISHAAN)} @ ${zakV.purchase_price} (release ${refund(zakV.purchase_price)})`);
