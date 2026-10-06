/**
 * One-shot: import UCL Live Auction 1 → online auction id 10.
 * Usage: node scripts/setup-ucl-online-from-live-1.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

const LIVE_AUCTION_ID = "7f57087e-4750-4c24-b46f-c9774093518c";
const ONLINE_AUCTION_ID = 10;
const AUCTION_NAME = "UEFA Champions League 2026/27 Auction 1";

const script = path.join(__dirname, "setup-online-auction-from-live.mjs");
const args = [
  script,
  "--live-auction-id",
  LIVE_AUCTION_ID,
  "--auction-id",
  String(ONLINE_AUCTION_ID),
  "--name",
  AUCTION_NAME,
  "--competition-id",
  "4",
  "--complete-live-auction",
];

const result = spawnSync(process.execPath, args, { cwd: appRoot, stdio: "inherit" });
process.exit(result.status ?? 1);
