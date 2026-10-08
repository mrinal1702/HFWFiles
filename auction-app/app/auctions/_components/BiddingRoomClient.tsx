"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ManagerChip } from "@/app/_components/entity/ManagerChip";
import { getBidDisabledReason, lotRaiseModeActive } from "@/lib/auction-state/auction-bid-gates";
import { lotRowAnchorId } from "@/lib/auction-state/lot-row-anchor";
import { nextMinimumBidAmount, positionSortRank } from "@/lib/auction-state/bid-ui-messages";
import type { BidGateContext, EnrichedLot } from "@/lib/auction-types";

import { BidRowForm } from "./BidRowForm";
import { PositionPill, positionTheme } from "./position-theme";
import { LocalTime } from "./LocalTime";

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
  if (lot.status === "bidding" && !biddingClosed && !lot.nation_bidding_closed) return 0;
  if (lot.status === "sold") return 2;
  return 1;
}

const selectClass =
  "min-h-9 w-full rounded-xl border border-sky-100 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 sm:min-h-10 sm:px-3 sm:py-2";

/** Soft tints per lot state (labels unchanged). */
const STATUS_TONE: Record<string, { pill: string; dot: string; stripe: string }> = {
  bidding: { pill: "border-sky-200 bg-sky-50 text-sky-800", dot: "bg-sky-500 animate-pulse", stripe: "bg-sky-500" },
  uninitiated: { pill: "border-slate-200 bg-slate-50 text-slate-600", dot: "bg-slate-300", stripe: "bg-slate-200" },
  sold: { pill: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500", stripe: "bg-emerald-400" },
  unsold: { pill: "border-slate-200 bg-slate-100 text-slate-600", dot: "bg-slate-400", stripe: "bg-slate-300" },
  closed_bidding_after_deadline: {
    pill: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
    stripe: "bg-amber-400",
  },
};
const statusTone = (status: string) => STATUS_TONE[status] ?? STATUS_TONE.uninitiated;

function StatusBadge({ status }: { status: string }) {
  const t = statusTone(status);
  return (
    <span
      className={`inline-flex max-w-[min(100%,12rem)] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-left text-[11px] font-medium leading-snug sm:max-w-[min(100%,14rem)] sm:px-2.5 sm:py-1 sm:text-xs ${t.pill}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />
      {statusLabel(status)}
    </span>
  );
}


const TAB_DEFS = [
  ["all", "All players"],
  ["ongoing", "Ongoing bids"],
  ["unsold", "Unsold (no bids)"],
  ["sold", "Sold"],
  ["search", "Search player"],
] as const;

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
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs sm:gap-1.5 sm:text-sm">
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
      <label className="flex flex-col gap-1 text-xs sm:gap-1.5 sm:text-sm">
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
        <label className="flex flex-col gap-1 text-xs sm:gap-1.5 sm:text-sm">
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
        <label className="flex flex-col gap-1 text-xs sm:gap-1.5 sm:text-sm">
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
      <label className="flex flex-col gap-1 text-xs sm:col-span-2 sm:gap-1.5 sm:text-sm lg:col-span-1">
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
    <div className="space-y-3 sm:space-y-5">
      <div className="flex gap-1 overflow-x-auto overflow-y-hidden rounded-xl border border-sky-100 bg-sky-50/60 p-1 [scrollbar-width:thin]">
        {TAB_DEFS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium leading-tight transition sm:px-4 sm:py-2 sm:text-sm ${
              tab === k
                ? "bg-gradient-to-r from-sky-500 to-sky-700 text-white shadow-sm shadow-sky-200"
                : "text-slate-700 hover:bg-white hover:text-sky-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "search" ? (
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 p-4 shadow-sm sm:p-5">
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
                      prefetch={false}
                      className={`block rounded-xl border border-sky-100 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md ${
                        i % 2 === 0 ? "bg-white" : "bg-sky-50/60"
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
        <details className="group rounded-xl border border-sky-100 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-900 sm:py-2.5">
            <span>Filters &amp; sort</span>
            <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-500">
              Tap to expand
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 text-sky-500 transition group-open:rotate-180"
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </summary>
          <div className="border-t border-sky-100 px-4 pb-4 pt-3">{filterFields}</div>
        </details>
      </div>

      <div className="hidden lg:block">{filterFields}</div>

      <p className="text-xs leading-relaxed text-slate-500">
        Winning bids and player deadlines update when a bid is placed. Hit the{" "}
        <span className="font-medium text-slate-800">Refresh</span> button at the top to see the latest
        bids.
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sky-200 bg-white px-4 py-10 text-center text-slate-500">
          No rows match this view.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((lot) => {
              const disabledReason = getBidDisabledReason(lot, gate);
              const minBid = nextMinimumBidAmount(lot.high_amount, lotRaiseModeActive(lot, gate));
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
                  id={lotRowAnchorId(lot.player_id)}
                  className={`relative scroll-mt-28 overflow-hidden rounded-xl border py-2.5 pl-4 pr-3 shadow-sm ${positionTheme(lot.position).card}`}
                >
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 w-1.5 ${positionTheme(lot.position).stripe}`}
                  />
                  <div className="flex flex-wrap items-start justify-between gap-1.5 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold leading-snug text-slate-900">
                        <Link href={playerHref(lot.player_id)} prefetch={false} className="hover:underline">
                          {lot.player_name ?? `Player #${lot.player_id}`}
                        </Link>
                      </h3>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                        <span>{lot.club ?? "—"}</span>
                        <PositionPill position={lot.position} />
                      </p>
                    </div>
                    <StatusBadge status={displayLotStatus(lot, gate.biddingClosed)} />
                  </div>
                  <dl className="mt-2 space-y-1 rounded-lg bg-white/80 px-2 py-1.5 text-xs ring-1 ring-black/5">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-600">High bid</dt>
                      <dd className="font-mono text-sm font-semibold tabular-nums text-slate-900">{highDisplay}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-600">High bidder</dt>
                      <dd className="min-w-0 text-right text-slate-800">
                        {lot.high_bidder_id != null ? (
                          <ManagerChip
                            auctionId={auctionId}
                            auctionUserId={lot.high_bidder_id}
                            name={lot.high_bidder_name}
                            avatarUrl={lot.high_bidder_avatar_url}
                            className="justify-end gap-1"
                            labelClassName="text-xs font-medium"
                          />
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    {showDeadlineCol && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-600">Lot deadline</dt>
                        <dd className="max-w-[65%] text-right text-[11px] text-slate-600">
                          {lot.status === "bidding" && !gate.biddingClosed
                            ? <LocalTime iso={lot.expires_at} />
                            : "—"}
                        </dd>
                      </div>
                    )}
                    {tab === "sold" && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-600">Sold at</dt>
                        <dd className="text-[11px] text-slate-600">—</dd>
                      </div>
                    )}
                  </dl>
                  {showBidCol && (
                    <div className="mt-2 pt-1">
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
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[44rem] border-separate border-spacing-y-2 text-left text-sm lg:min-w-[56rem]">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Player</th>
                  <th className="px-3 py-2 font-semibold">Club</th>
                  <th className="px-3 py-2 font-semibold">Pos</th>
                  <th className="px-3 py-2 font-semibold">State</th>
                  <th className="px-3 py-2 font-semibold">High bid</th>
                  <th className="px-3 py-2 font-semibold">High bidder</th>
                  {showDeadlineCol && <th className="px-3 py-2 font-semibold">Lot deadline</th>}
                  {tab === "sold" && <th className="px-3 py-2 font-semibold">Sold at (local)</th>}
                  {showBidCol && <th className="px-3 py-2 font-semibold">Bid</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lot) => {
                  const disabledReason = getBidDisabledReason(lot, gate);
                  const minBid = nextMinimumBidAmount(lot.high_amount, lotRaiseModeActive(lot, gate));
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
                      id={lotRowAnchorId(lot.player_id)}
                      className={`scroll-mt-28 [&>td]:border-y [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l-[6px] [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r ${positionTheme(lot.position).row}`}
                    >
                      <td className="px-3 py-3 align-top font-medium text-slate-900">
                        <Link
                          href={playerHref(lot.player_id)}
                          prefetch={false}
                          className="block truncate hover:underline"
                        >
                          {lot.player_name ?? `Player #${lot.player_id}`}
                        </Link>
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-3 align-top text-slate-600">
                        {lot.club ?? "—"}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <PositionPill position={lot.position} />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <StatusBadge status={displayLotStatus(lot, gate.biddingClosed)} />
                      </td>
                      <td className="px-3 py-3 align-top font-mono text-base font-semibold tabular-nums text-slate-900">
                        {highDisplay}
                      </td>
                      <td className="px-3 py-3 align-top text-slate-600">
                        {lot.high_bidder_id != null ? (
                          <ManagerChip
                            auctionId={auctionId}
                            auctionUserId={lot.high_bidder_id}
                            name={lot.high_bidder_name}
                            avatarUrl={lot.high_bidder_avatar_url}
                            labelClassName="font-medium"
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      {showDeadlineCol && (
                        <td className="px-3 py-3 align-top text-xs text-slate-600">
                          {lot.status === "bidding" && !gate.biddingClosed
                            ? <LocalTime iso={lot.expires_at} />
                            : "—"}
                        </td>
                      )}
                      {tab === "sold" && <td className="px-3 py-3 align-top text-xs text-slate-600">—</td>}
                      {showBidCol && (
                        <td className="px-3 py-3 align-top">
                          {/* Width lives on a div, not the cell: Safari ignores min-width on table cells. */}
                          <div className="min-w-[12.5rem]">
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
                          </div>
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
