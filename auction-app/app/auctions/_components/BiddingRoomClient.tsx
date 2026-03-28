"use client";

import { useMemo, useState } from "react";

import { getBidDisabledReason } from "@/lib/auction-bid-gates";
import { nextMinimumBidAmount } from "@/lib/bid-ui-messages";
import type { BidGateContext, EnrichedLot } from "@/lib/auction-types";

import { BidRowForm } from "./BidRowForm";

type Tab = "all" | "ongoing" | "unsold" | "sold";

function statusLabel(status: string): string {
  switch (status) {
    case "uninitiated":
      return "Unsold (no bids)";
    case "bidding":
      return "Ongoing";
    case "sold":
      return "Sold";
    case "unsold":
      return "Closed (unsold)";
    default:
      return status;
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString()} (local)`;
}

export function BiddingRoomClient({
  auctionId,
  lots,
  gate,
}: {
  auctionId: number;
  lots: EnrichedLot[];
  gate: BidGateContext;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [club, setClub] = useState("");
  const [position, setPosition] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [bidderFilter, setBidderFilter] = useState("");
  const [sort, setSort] = useState<"" | "deadline-asc" | "deadline-desc" | "bid-high" | "bid-low">("");

  const clubs = useMemo(() => {
    const s = new Set<string>();
    for (const l of lots) {
      const c = l.club?.trim();
      if (c) s.add(c);
    }
    return [...s].sort();
  }, [lots]);

  const positions = useMemo(() => {
    const s = new Set<string>();
    for (const l of lots) {
      const p = l.position?.trim();
      if (p) s.add(p);
    }
    return [...s].sort();
  }, [lots]);

  const bidders = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const l of lots) {
      if (l.high_bidder_id != null) {
        m.set(l.high_bidder_id, l.high_bidder_name ?? `#${l.high_bidder_id}`);
      }
    }
    return [...m.entries()].sort((a, b) => (a[1] ?? "").localeCompare(b[1] ?? ""));
  }, [lots]);

  const filtered = useMemo(() => {
    let rows = lots.slice();
    if (tab === "ongoing") rows = rows.filter((l) => l.status === "bidding");
    else if (tab === "unsold") rows = rows.filter((l) => l.status === "uninitiated");
    else if (tab === "sold") rows = rows.filter((l) => l.status === "sold");

    if (club) rows = rows.filter((l) => (l.club ?? "").trim() === club);
    if (position) rows = rows.filter((l) => (l.position ?? "").trim() === position);
    if (statusFilter && tab === "all") {
      rows = rows.filter((l) => l.status === statusFilter);
    }
    if (bidderFilter && tab === "ongoing") {
      const id = Number(bidderFilter);
      rows = rows.filter((l) => l.high_bidder_id === id);
    }

    if (sort === "deadline-asc" || sort === "deadline-desc") {
      rows.sort((a, b) => {
        const ta = a.expires_at ? Date.parse(a.expires_at) : Infinity;
        const tb = b.expires_at ? Date.parse(b.expires_at) : Infinity;
        const da = Number.isNaN(ta) ? Infinity : ta;
        const db = Number.isNaN(tb) ? Infinity : tb;
        return sort === "deadline-asc" ? da - db : db - da;
      });
    } else if (sort === "bid-high" || sort === "bid-low") {
      rows.sort((a, b) => {
        const va = a.high_amount ?? -1;
        const vb = b.high_amount ?? -1;
        return sort === "bid-high" ? vb - va : va - vb;
      });
    } else {
      rows.sort((a, b) => a.player_id.localeCompare(b.player_id));
    }

    return rows;
  }, [lots, tab, club, position, statusFilter, bidderFilter, sort]);

  const showBidCol = tab !== "sold";
  const showDeadlineCol = tab === "ongoing" || tab === "all";
  const emptyColSpan =
    6 + (showDeadlineCol ? 1 : 0) + (tab === "sold" ? 1 : 0) + (showBidCol ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All players"],
            ["ongoing", "Ongoing bids"],
            ["unsold", "Unsold (no bids)"],
            ["sold", "Sold"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === k ? "bg-neutral-200 text-neutral-900" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-neutral-500">Club</span>
          <select
            className="rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-neutral-100"
            value={club}
            onChange={(e) => setClub(e.target.value)}
          >
            <option value="">All</option>
            {clubs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-neutral-500">Position</span>
          <select
            className="rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-neutral-100"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            <option value="">All</option>
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        {tab === "all" && (
          <label className="flex items-center gap-2">
            <span className="text-neutral-500">Lot state</span>
            <select
              className="rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-neutral-100"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="uninitiated">Unsold (no bids)</option>
              <option value="bidding">Ongoing</option>
              <option value="sold">Sold</option>
              <option value="unsold">Closed (unsold)</option>
            </select>
          </label>
        )}
        {tab === "ongoing" && (
          <label className="flex items-center gap-2">
            <span className="text-neutral-500">High bidder</span>
            <select
              className="rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-neutral-100"
              value={bidderFilter}
              onChange={(e) => setBidderFilter(e.target.value)}
            >
              <option value="">All</option>
              {bidders.map(([id, name]) => (
                <option key={id} value={String(id)}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2">
          <span className="text-neutral-500">Sort</span>
          <select
            className="rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-neutral-100"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="">Player id</option>
            <option value="deadline-asc">Deadline ↑</option>
            <option value="deadline-desc">Deadline ↓</option>
            <option value="bid-high">Bid high → low</option>
            <option value="bid-low">Bid low → high</option>
          </select>
        </label>
      </div>

      <p className="text-xs text-neutral-500">
        Bids can change quickly; use Refresh after you bid. The server decides if a bid is valid.
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead className="border-b border-neutral-800 bg-neutral-900/50 text-neutral-400">
            <tr>
              <th className="px-2 py-2 font-medium">Player</th>
              <th className="px-2 py-2 font-medium">Club</th>
              <th className="px-2 py-2 font-medium">Pos</th>
              <th className="px-2 py-2 font-medium">State</th>
              <th className="px-2 py-2 font-medium">High bid</th>
              <th className="px-2 py-2 font-medium">High bidder</th>
              {showDeadlineCol && <th className="px-2 py-2 font-medium">Lot deadline</th>}
              {tab === "sold" && <th className="px-2 py-2 font-medium">Sold at (local)</th>}
              {showBidCol && <th className="px-2 py-2 font-medium">Bid</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={emptyColSpan} className="px-2 py-6 text-center text-neutral-500">
                  No rows match this view.
                </td>
              </tr>
            ) : (
              filtered.map((lot) => {
                const disabledReason = getBidDisabledReason(lot, gate);
                const minBid = nextMinimumBidAmount(lot.high_amount);
                const highDisplay =
                  lot.status === "sold"
                    ? (lot.high_amount != null ? String(lot.high_amount) : "—")
                    : lot.status === "uninitiated"
                      ? "—"
                      : lot.high_amount != null
                        ? String(lot.high_amount)
                        : "—";
                return (
                  <tr key={lot.player_id} className="border-b border-neutral-800/80">
                    <td className="px-2 py-2">{lot.player_name ?? "—"}</td>
                    <td className="max-w-[10rem] truncate px-2 py-2 text-neutral-400">{lot.club ?? "—"}</td>
                    <td className="px-2 py-2 text-neutral-400">{lot.position ?? "—"}</td>
                    <td className="px-2 py-2">{statusLabel(lot.status)}</td>
                    <td className="px-2 py-2 font-mono">{highDisplay}</td>
                    <td className="px-2 py-2 text-neutral-400">
                      {lot.high_bidder_name ?? (lot.high_bidder_id != null ? `#${lot.high_bidder_id}` : "—")}
                    </td>
                    {showDeadlineCol && (
                      <td className="px-2 py-2 text-xs text-neutral-400">
                        {lot.status === "bidding" ? formatWhen(lot.expires_at) : "—"}
                      </td>
                    )}
                    {tab === "sold" && <td className="px-2 py-2 text-xs text-neutral-500">—</td>}
                    {showBidCol && (
                      <td className="px-2 py-2 align-top">
                        {lot.status === "sold" || lot.status === "unsold" ? (
                          <span className="text-xs text-neutral-500">—</span>
                        ) : (
                          <BidRowForm
                            auctionId={auctionId}
                            playerId={lot.player_id}
                            minBid={minBid}
                            disabledReason={disabledReason}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
