"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { getBidDisabledReason } from "@/lib/auction-bid-gates";
import { nextMinimumBidAmount, positionSortRank } from "@/lib/bid-ui-messages";
import type { BidGateContext, EnrichedLot } from "@/lib/auction-types";

import { BidRowForm } from "./BidRowForm";

type Tab = "all" | "ongoing" | "unsold" | "sold" | "search";

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
    case "closed_bidding_after_deadline":
      return "Closed (auction ended)";
    default:
      return status;
  }
}

function displayLotStatus(lot: EnrichedLot, biddingClosed: boolean): string {
  if (biddingClosed && lot.status === "bidding") return "closed_bidding_after_deadline";
  return lot.status;
}

/** Parsed bid deadline in ms, or null if none / invalid. */
function bidDeadlineMs(lot: EnrichedLot): number | null {
  if (!lot.expires_at) return null;
  const t = Date.parse(lot.expires_at);
  return Number.isNaN(t) ? null : t;
}

/** Default sort: 0 = active bidding, 1 = unsold (incl. closed bidding), 2 = sold. */
function defaultSortTier(lot: EnrichedLot, biddingClosed: boolean): 0 | 1 | 2 {
  if (lot.status === "bidding" && !biddingClosed) return 0;
  if (lot.status === "sold") return 2;
  return 1;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex max-w-[min(100%,14rem)] shrink-0 items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-left text-xs font-medium leading-snug text-slate-800">
      {statusLabel(status)}
    </span>
  );
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString()} (local)`;
}

const TAB_DEFS = [
  ["all", "All players"],
  ["ongoing", "Ongoing bids"],
  ["unsold", "Unsold (no bids)"],
  ["sold", "Sold"],
  ["search", "Search player"],
] as const;

const selectClass =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 sm:min-h-10 sm:text-sm";

export function BiddingRoomClient({
  auctionId,
  lots,
  gate,
}: {
  auctionId: number;
  lots: EnrichedLot[];
  gate: BidGateContext;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const tabParam = sp.get("tab");
  const initialTab: Tab = tabParam === "search" ? "search" : "all";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [club, setClub] = useState("");
  const [position, setPosition] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [bidderFilter, setBidderFilter] = useState("");
  const [sort, setSort] = useState<"" | "deadline-asc" | "deadline-desc" | "bid-high" | "bid-low">("");
  const [searchQuery, setSearchQuery] = useState("");

  const returnTo = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
  const searchReturnTo = `/auctions/${auctionId}/bidding-room?tab=search`;
  const playerHref = (playerId: string) =>
    `/auctions/${auctionId}/players/${playerId}?returnTo=${encodeURIComponent(
      tab === "search" ? searchReturnTo : returnTo,
    )}`;

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
    if (tab === "search") return [];
    let rows = lots.slice();
    if (tab === "ongoing") {
      rows = rows.filter((l) => l.status === "bidding" && !gate.biddingClosed);
    } else if (tab === "unsold") {
      rows = rows.filter((l) => l.status === "uninitiated" || l.status === "unsold");
    } else if (tab === "sold") {
      rows = rows.filter((l) => l.status === "sold");
    }

    if (club) rows = rows.filter((l) => (l.club ?? "").trim() === club);
    if (position) rows = rows.filter((l) => (l.position ?? "").trim() === position);
    if (statusFilter && tab === "all") {
      rows = rows.filter((l) => displayLotStatus(l, gate.biddingClosed) === statusFilter);
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
      // Default: ongoing (latest deadline first) → unsold → sold; then team_id, position, player_id.
      rows.sort((a, b) => {
        const ta = defaultSortTier(a, gate.biddingClosed);
        const tb = defaultSortTier(b, gate.biddingClosed);
        if (ta !== tb) return ta - tb;

        if (ta === 0) {
          const da = bidDeadlineMs(a);
          const db = bidDeadlineMs(b);
          if (da != null && db != null) return db - da;
          if (da != null && db == null) return -1;
          if (da == null && db != null) return 1;
          return a.player_id.localeCompare(b.player_id);
        }

        const teamA = a.team_id ?? Number.MAX_SAFE_INTEGER;
        const teamB = b.team_id ?? Number.MAX_SAFE_INTEGER;
        if (teamA !== teamB) return teamA - teamB;
        const pa = positionSortRank(a.position);
        const pb = positionSortRank(b.position);
        if (pa !== pb) return pa - pb;
        return a.player_id.localeCompare(b.player_id);
      });
    }

    return rows;
  }, [lots, tab, club, position, statusFilter, bidderFilter, sort, gate.biddingClosed]);

  const showBidCol = tab !== "sold";
  const showDeadlineCol = tab === "ongoing" || tab === "all";

  const filterFields = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-slate-700">Club</span>
        <select className={selectClass} value={club} onChange={(e) => setClub(e.target.value)}>
          <option value="">All</option>
          {clubs.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-slate-700">Position</span>
        <select className={selectClass} value={position} onChange={(e) => setPosition(e.target.value)}>
          <option value="">All</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      {tab === "all" && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">Lot state</span>
          <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="uninitiated">Unsold (no bids)</option>
            <option value="bidding">Ongoing</option>
            <option value="sold">Sold</option>
            <option value="unsold">Closed (unsold)</option>
          </select>
        </label>
      )}
      {tab === "ongoing" && (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">High bidder</span>
          <select className={selectClass} value={bidderFilter} onChange={(e) => setBidderFilter(e.target.value)}>
            <option value="">All</option>
            {bidders.map(([id, name]) => (
              <option key={id} value={String(id)}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1.5 text-sm sm:col-span-2 lg:col-span-1">
        <span className="font-medium text-slate-700">Sort</span>
        <select className={selectClass} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="">Default (ongoing → unsold → sold)</option>
          <option value="deadline-asc">Deadline ↑</option>
          <option value="deadline-desc">Deadline ↓</option>
          <option value="bid-high">Bid high → low</option>
          <option value="bid-low">Bid low → high</option>
        </select>
      </label>
    </div>
  );

  const searchParts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return q.split(/\s+/).filter(Boolean);
  }, [searchQuery]);

  const suggestions = useMemo(() => {
    if (tab !== "search") return [];
    if (searchParts.length === 0) return [];

    const results = lots.filter((l) => {
      const name = (l.player_name ?? "").trim();
      if (!name) return false;
      const tokens = name.split(/\s+/).map((t) => t.toLowerCase());
      return searchParts.every((qPart) => tokens.some((t) => t.startsWith(qPart)));
    });

    results.sort((a, b) => (a.player_name ?? "").localeCompare(b.player_name ?? ""));
    return results.slice(0, 10);
  }, [lots, searchParts, tab]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="-mx-1 flex gap-2 overflow-x-auto overflow-y-hidden px-1 pb-1 [scrollbar-width:thin]">
        {TAB_DEFS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium leading-tight sm:py-2 ${
              tab === k
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-800 hover:bg-sky-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "search" ? (
        <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Search player</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Start typing a first or last name. Suggestions update as you type.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setTab("all");
              }}
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-sky-50/50"
            >
              Back to list
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <label className="flex-1">
              <span className="sr-only">Search by player name</span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Alv or Jul…"
                className={selectClass}
              />
            </label>
            <button
              type="button"
              disabled={!searchQuery.trim()}
              onClick={() => setSearchQuery("")}
              className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm disabled:opacity-50 hover:bg-sky-50/50 sm:px-5"
            >
              Clear
            </button>
          </div>

          {searchParts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              Tip: try a last-name prefix like <span className="font-medium text-slate-800">Alv</span> or
              a first-name prefix like <span className="font-medium text-slate-800">Jul</span>.
            </p>
          ) : suggestions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No matches found.</p>
          ) : (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-slate-600">
                Suggestions ({suggestions.length})
              </p>
              <ul className="space-y-2">
                {suggestions.map((l, i) => (
                  <li key={l.player_id}>
                    <Link
                      href={playerHref(l.player_id)}
                      className={`block rounded-xl border border-sky-100 px-4 py-3 shadow-sm ${
                        i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {l.player_name ?? `Player #${l.player_id}`}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {(l.club ?? "—") + " · " + (l.position ?? "—")}
                          </div>
                          <div className="mt-2 text-xs font-medium text-slate-600">
                            High bid:{" "}
                            <span className="font-mono text-slate-900">
                              {l.high_amount != null ? l.high_amount : "—"}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={displayLotStatus(l, gate.biddingClosed)} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="lg:hidden">
        <details className="rounded-lg border border-sky-100 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-900 sm:py-2.5">
            <span>Filters &amp; sort</span>
            <span className="text-xs font-normal text-slate-600">Tap to expand</span>
          </summary>
          <div className="border-t border-slate-200 px-4 pb-4 pt-3">{filterFields}</div>
        </details>
      </div>

      <div className="hidden lg:block">{filterFields}</div>

      <p className="text-xs leading-relaxed text-slate-600">
        High bids and timers update when anyone bids. After yours goes through, tap{" "}
        <span className="font-medium text-slate-800">Refresh</span> at the top so you&apos;re looking at
        the latest numbers.
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-slate-600 shadow-sm">
          No rows match this view.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((lot, i) => {
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
                <article
                  key={lot.player_id}
                  className={`rounded-xl border border-sky-100 px-4 py-4 shadow-sm ${
                    i % 2 === 0 ? "bg-white" : "bg-sky-50/80"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-medium leading-snug text-slate-900">
                        <Link href={playerHref(lot.player_id)} className="hover:underline">
                          {lot.player_name ?? `Player #${lot.player_id}`}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {(lot.club ?? "—") + " · " + (lot.position ?? "—")}
                      </p>
                    </div>
                    <StatusBadge status={displayLotStatus(lot, gate.biddingClosed)} />
                  </div>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">High bid</dt>
                      <dd className="font-mono font-medium text-slate-900">{highDisplay}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-600">High bidder</dt>
                      <dd className="min-w-0 text-right text-slate-800">
                        {lot.high_bidder_name ?? (lot.high_bidder_id != null ? `#${lot.high_bidder_id}` : "—")}
                      </dd>
                    </div>
                    {showDeadlineCol && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-600">Lot deadline</dt>
                        <dd className="max-w-[65%] text-right text-xs text-slate-600">
                          {lot.status === "bidding" && !gate.biddingClosed
                            ? formatWhen(lot.expires_at)
                            : "—"}
                        </dd>
                      </div>
                    )}
                    {tab === "sold" && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-600">Sold at</dt>
                        <dd className="text-xs text-slate-600">—</dd>
                      </div>
                    )}
                  </dl>
                  {showBidCol && (
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      {lot.status === "sold" || lot.status === "unsold" || gate.biddingClosed ? (
                        <span className="text-sm text-slate-500">—</span>
                      ) : (
                        <BidRowForm
                          auctionId={auctionId}
                          playerId={lot.player_id}
                          minBid={minBid}
                          disabledReason={disabledReason}
                        />
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm lg:min-w-[56rem]">
              <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
                <tr>
                  <th className="px-3 py-3 font-semibold">Player</th>
                  <th className="px-3 py-3 font-semibold">Club</th>
                  <th className="px-3 py-3 font-semibold">Pos</th>
                  <th className="px-3 py-3 font-semibold">State</th>
                  <th className="px-3 py-3 font-semibold">High bid</th>
                  <th className="px-3 py-3 font-semibold">High bidder</th>
                  {showDeadlineCol && <th className="px-3 py-3 font-semibold">Lot deadline</th>}
                  {tab === "sold" && <th className="px-3 py-3 font-semibold">Sold at (local)</th>}
                  {showBidCol && <th className="px-3 py-3 font-semibold">Bid</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lot, i) => {
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
                    <tr
                      key={lot.player_id}
                      className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-sky-50/50" : "bg-white"}`}
                    >
                      <td className="px-3 py-3 align-top text-slate-900">
                        <Link
                          href={playerHref(lot.player_id)}
                          className="block truncate hover:underline"
                        >
                          {lot.player_name ?? `Player #${lot.player_id}`}
                        </Link>
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-3 align-top text-slate-600">
                        {lot.club ?? "—"}
                      </td>
                      <td className="px-3 py-3 align-top text-slate-600">{lot.position ?? "—"}</td>
                      <td className="px-3 py-3 align-top text-slate-800">
                        {statusLabel(displayLotStatus(lot, gate.biddingClosed))}
                      </td>
                      <td className="px-3 py-3 align-top font-mono font-medium text-slate-900">
                        {highDisplay}
                      </td>
                      <td className="px-3 py-3 align-top text-slate-600">
                        {lot.high_bidder_name ?? (lot.high_bidder_id != null ? `#${lot.high_bidder_id}` : "—")}
                      </td>
                      {showDeadlineCol && (
                        <td className="px-3 py-3 align-top text-xs text-slate-600">
                          {lot.status === "bidding" && !gate.biddingClosed
                            ? formatWhen(lot.expires_at)
                            : "—"}
                        </td>
                      )}
                      {tab === "sold" && <td className="px-3 py-3 align-top text-xs text-slate-600">—</td>}
                      {showBidCol && (
                        <td className="px-3 py-3 align-top">
                          {lot.status === "sold" || lot.status === "unsold" || gate.biddingClosed ? (
                            <span className="text-xs text-slate-500">—</span>
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
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
}
