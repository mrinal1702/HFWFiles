import Link from "next/link";

import { getLabAuctionId } from "@/lib/auction-lab-config";
import { createAdminClient } from "@/lib/supabase-server";

import { BidForm, type LabLotOption, type LabUserOption } from "./BidForm";

export const dynamic = "force-dynamic";

type LotRow = {
  player_id: string;
  player_name: string | null;
  position: string | null;
  status: string;
  expires_at: string | null;
  high_bidder_id: number | null;
  high_amount: number | null;
};

type AuctionSummary = {
  id: number;
  name: string | null;
  hard_deadline_at: string | null;
  is_active: boolean | null;
};

export default async function AuctionLabPage() {
  const auctionId = getLabAuctionId();

  let configError: string | null = null;
  const loadWarnings: string[] = [];
  let auction: AuctionSummary | null = null;
  let users: LabUserOption[] = [];
  let lotRows: LotRow[] = [];

  try {
    const admin = createAdminClient();

    const [auctionRes, usersRes, lotsRes] = await Promise.all([
      admin.from("Auctions").select("id,name,hard_deadline_at,is_active").eq("id", auctionId).maybeSingle(),
      admin
        .from("auction_users")
        .select("id,name,budget_remaining,active_budget")
        .eq("auction_id", auctionId)
        .order("id", { ascending: true }),
      admin.from("auction_lots").select("*").eq("auction_id", auctionId).order("player_id", { ascending: true }),
    ]);

    if (auctionRes.error) {
      loadWarnings.push(`Auctions: ${auctionRes.error.message}`);
    } else {
      auction = auctionRes.data as AuctionSummary;
    }

    if (usersRes.error) {
      configError = `auction_users: ${usersRes.error.message}`;
    } else {
      users = (usersRes.data ?? []) as LabUserOption[];
    }

    if (lotsRes.error) {
      configError = configError ?? `auction_lots: ${lotsRes.error.message}`;
    } else {
      const rawLots = lotsRes.data ?? [];
      const playerIds = [...new Set(rawLots.map((r: { player_id: string }) => String(r.player_id)))];
      const bidIds = rawLots
        .map((r: { current_high_bid_id: number | null }) => r.current_high_bid_id)
        .filter((id): id is number => id != null);

      const playersRes = playerIds.length
        ? await admin.from("players").select("player_id, player_name, position").in("player_id", playerIds)
        : { data: [] as Record<string, unknown>[], error: null };

      const bidsRes = bidIds.length
        ? await admin.from("auction_bids").select("id, amount, auction_user_id").in("id", bidIds)
        : { data: [] as Record<string, unknown>[], error: null };

      if (playersRes.error) {
        loadWarnings.push(`players: ${playersRes.error.message}`);
      }
      if (bidsRes.error) {
        loadWarnings.push(`auction_bids: ${bidsRes.error.message}`);
      }

      const playerById = new Map<string, { player_name: string | null; position: string | null }>();
      for (const p of playersRes.data ?? []) {
        const row = p as { player_id: string; player_name: string | null; position: string | null };
        playerById.set(String(row.player_id), {
          player_name: row.player_name ?? null,
          position: row.position ?? null,
        });
      }

      const bidById = new Map<number, { amount: number; auction_user_id: number }>();
      for (const b of bidsRes.data ?? []) {
        const row = b as { id: number; amount: number; auction_user_id: number };
        bidById.set(row.id, { amount: row.amount, auction_user_id: row.auction_user_id });
      }

      lotRows = rawLots.map((l: Record<string, unknown>) => {
        const pid = String(l.player_id);
        const meta = playerById.get(pid);
        const bidId = l.current_high_bid_id as number | null;
        const bid = bidId != null ? bidById.get(bidId) : undefined;
        return {
          player_id: pid,
          player_name: meta?.player_name ?? null,
          position: meta?.position ?? null,
          status: String(l.status),
          expires_at: l.expires_at != null ? String(l.expires_at) : null,
          high_bidder_id: bid?.auction_user_id ?? null,
          high_amount: bid?.amount ?? null,
        };
      });
    }
  } catch (e) {
    configError = e instanceof Error ? e.message : String(e);
  }

  const lotsForForm: LabLotOption[] = lotRows.map((r) => ({
    player_id: r.player_id,
    player_name: r.player_name,
    status: r.status,
  }));

  return (
    <main className="mx-auto max-w-5xl flex-1 p-6">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auction lab</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Integration test page · auction id <code className="text-neutral-400">{auctionId}</code> (
            set <code className="text-neutral-400">AUCTION_LAB_AUCTION_ID</code> in{" "}
            <code className="text-neutral-400">.env.local</code> to change)
          </p>
        </div>
        <Link href="/" className="text-sm text-neutral-400 underline hover:text-neutral-200">
          ← Home
        </Link>
      </div>

      {configError && (
        <div
          className="mb-6 rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          <p className="font-medium">Could not load required data</p>
          <p className="mt-1 font-mono text-xs text-amber-200/90">{configError}</p>
          <p className="mt-2 text-amber-200/80">
            Add <code className="text-amber-100">SUPABASE_SERVICE_ROLE_KEY</code> to{" "}
            <code className="text-amber-100">.env.local</code> (Supabase → Project Settings → API → service_role
            secret). Restart <code className="text-amber-100">npm run dev</code> after saving.
          </p>
        </div>
      )}

      {loadWarnings.length > 0 && (
        <div
          className="mb-6 rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-3 text-sm text-neutral-300"
          role="status"
        >
          <p className="font-medium text-neutral-200">Non-fatal warnings</p>
          <ul className="mt-2 list-inside list-disc font-mono text-xs">
            {loadWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {auction && (
        <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-sm">
          <p>
            <span className="text-neutral-500">Auction</span>{" "}
            <span className="text-neutral-200">{auction.name ?? `#${auction.id}`}</span>
          </p>
          <p className="mt-1">
            <span className="text-neutral-500">Hard deadline</span>{" "}
            <span className="text-neutral-200">
              {auction.hard_deadline_at
                ? new Date(auction.hard_deadline_at).toLocaleString()
                : "not set"}
            </span>
          </p>
        </div>
      )}

      {!configError && (
        <div className="mb-8">
          <BidForm users={users} lots={lotsForForm} />
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Managers</h2>
        {users.length === 0 ? (
          <p className="text-sm text-neutral-500">No rows in auction_users for this auction.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Id</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">budget_remaining</th>
                  <th className="px-3 py-2 font-medium">active_budget</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-neutral-800/80">
                    <td className="px-3 py-2 font-mono text-neutral-300">{u.id}</td>
                    <td className="px-3 py-2">{u.name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{u.budget_remaining}</td>
                    <td className="px-3 py-2 font-mono">{u.active_budget}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Lots</h2>
        {lotRows.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No rows in auction_lots for this auction. Create lots in Supabase (one row per player in the
            pool) before bidding from here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-medium">player_id</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Pos</th>
                  <th className="px-3 py-2 font-medium">status</th>
                  <th className="px-3 py-2 font-medium">expires</th>
                  <th className="px-3 py-2 font-medium">high $</th>
                  <th className="px-3 py-2 font-medium">high bidder</th>
                </tr>
              </thead>
              <tbody>
                {lotRows.map((r) => (
                  <tr key={r.player_id} className="border-b border-neutral-800/80">
                    <td className="max-w-[8rem] truncate px-3 py-2 font-mono text-xs text-neutral-300">
                      {r.player_id}
                    </td>
                    <td className="px-3 py-2">{r.player_name ?? "—"}</td>
                    <td className="px-3 py-2 text-neutral-400">{r.position ?? "—"}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2 text-xs text-neutral-400">
                      {r.expires_at ? new Date(r.expires_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.high_amount ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-neutral-400">
                      {r.high_bidder_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
