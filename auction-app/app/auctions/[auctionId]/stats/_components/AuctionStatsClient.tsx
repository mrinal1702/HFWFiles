"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { InfoTip } from "@/app/_components/InfoTip";
import { PositionPill } from "@/app/auctions/_components/position-theme";
import type { AuctionStatsData, StatsPlayer, StatsPos } from "@/lib/stats/auction-stats";

/** Minimum minutes (over the selected gameweeks) to appear in Points per 90. */
const MIN_MINUTES_PER_90 = 180;
/** Minimum minutes played for the manager to appear in Worst value signings. */
const MIN_MINUTES_WORST_VALUE = 45;

type Totals = { player: StatsPlayer; pts: number; min: number; apps: number };

const fmt = (n: number, dp = 0) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

function byPoints(a: Totals, b: Totals) {
  return b.pts - a.pts || a.player.name.localeCompare(b.player.name);
}

export function AuctionStatsClient({ auctionId, data }: { auctionId: number; data: AuctionStatsData }) {
  const allIds = useMemo(() => data.gameweeks.map((g) => g.id), [data.gameweeks]);
  const [selected, setSelected] = useState<number[]>(allIds);
  const sel = useMemo(() => new Set(selected), [selected]);

  const playerHref = (id: number) =>
    `/auctions/${auctionId}/players/${id}?returnTo=${encodeURIComponent(`/auctions/${auctionId}/stats`)}`;

  const toggle = (id: number) => {
    setSelected((cur) => {
      if (cur.length === allIds.length) return [id]; // from "All", a tap picks just that gameweek
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return next.length === 0 ? allIds : next.sort((a, b) => a - b);
    });
  };

  const stats = useMemo(() => {
    const totals: Totals[] = [];
    const byId = new Map<number, Totals>();
    for (const p of data.players) {
      if (!p.pool) continue; // not in this auction's player pool
      let pts = 0;
      let min = 0;
      let apps = 0;
      for (const [gw, [gp, gm]] of Object.entries(p.gw)) {
        if (!sel.has(Number(gw))) continue;
        pts += gp;
        min += gm;
        if (gm > 0) apps += 1;
      }
      const t = { player: p, pts, min, apps };
      byId.set(p.id, t);
      if (min > 0 || pts !== 0) totals.push(t);
    }
    const ranked = [...totals].sort(byPoints);
    const top = (pos?: StatsPos, n = 10) => (pos ? ranked.filter((t) => t.player.pos === pos) : ranked).slice(0, n);

    const per90 = totals
      .filter((t) => t.min >= MIN_MINUTES_PER_90)
      .map((t) => ({ ...t, p90: (t.pts / t.min) * 90 }))
      .sort((a, b) => b.p90 - a.p90 || a.player.name.localeCompare(b.player.name))
      .slice(0, 10);

    // Value: only points (and minutes) from gameweeks the manager held the player at lock.
    const stintValues = data.stints
      .map((s) => {
        const p = byId.get(s.player);
        if (!p || s.price <= 0) return null;
        const gws = s.gws.filter((g) => sel.has(g));
        if (!gws.length) return null;
        let pts = 0;
        let min = 0;
        for (const g of gws) {
          const [gp, gm] = p.player.gw[String(g)] ?? [0, 0];
          pts += gp;
          min += gm;
        }
        return { stint: s, player: p.player, gws: gws.length, pts, min, ratio: pts / s.price };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    const value = [...stintValues].sort((a, b) => b.ratio - a.ratio || b.pts - a.pts).slice(0, 10);

    // Worst value: lowest points per 1m. Price is the original purchase price (transfers keep it).
    const worst = stintValues
      .filter((v) => v.ratio > 0 && v.min >= MIN_MINUTES_WORST_VALUE)
      .sort((a, b) => a.ratio - b.ratio || b.stint.price - a.stint.price)
      .slice(0, 10);

    const owned = new Set(data.ownedNow);
    const freeAgents = ranked.filter((t) => !owned.has(t.player.id)).slice(0, 10);

    return {
      top: top(),
      per90,
      value,
      worst,
      freeAgents,
      gk: top("GK", 5),
      def: top("DEF"),
      mid: top("MID"),
      fwd: top("FWD"),
    };
  }, [data, sel]);

  const allSelected = selected.length === allIds.length;
  const selLabel = allSelected
    ? "all gameweeks"
    : data.gameweeks.filter((g) => sel.has(g.id)).map((g) => g.label).join(", ");

  const PlayerCell = ({ p }: { p: StatsPlayer }) => (
    <td className="px-3 py-2">
      <Link href={playerHref(p.id)} className="font-display font-semibold text-slate-900 hover:text-sky-700 hover:underline">
        {p.name}
      </Link>
      <span className="block text-xs text-slate-500 sm:hidden">{p.club}</span>
    </td>
  );
  const ClubCell = ({ p }: { p: StatsPlayer }) => (
    <td className="hidden px-3 py-2 text-slate-600 sm:table-cell">{p.club}</td>
  );

  const pointsTable = (rows: Totals[], showPos = true) => (
    <StatsTable
      head={["#", "Player", "Club", ...(showPos ? ["Pos"] : []), "Apps", "Pts"]}
      hideOnPhone={[2]}
      empty={rows.length === 0}
    >
      {rows.map((t, i) => (
        <tr key={t.player.id} className="border-t border-slate-100">
          <td className="px-3 py-2 tabular-nums text-slate-400">{i + 1}</td>
          <PlayerCell p={t.player} />
          <ClubCell p={t.player} />
          {showPos && (
            <td className="px-3 py-2">
              <PositionPill position={t.player.pos} />
            </td>
          )}
          <td className="px-3 py-2 text-right tabular-nums text-slate-600">{t.apps}</td>
          <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{fmt(t.pts)}</td>
        </tr>
      ))}
    </StatsTable>
  );

  type StintValue = (typeof stats.value)[number];
  const valueTable = (rows: StintValue[], extra: "gws" | "mins") => (
    <StatsTable
      head={["#", "Player", "Manager", "Price", extra === "gws" ? "GWs" : "Mins", "Pts", "Pts/m"]}
      hideOnPhone={[4]}
      empty={rows.length === 0}
    >
      {rows.map((v, i) => (
        <tr key={`${v.stint.manager}-${v.stint.player}-${v.stint.price}`} className="border-t border-slate-100">
          <td className="px-3 py-2 tabular-nums text-slate-400">{i + 1}</td>
          <PlayerCell p={v.player} />
          <td className="px-3 py-2 text-slate-700">{data.managers[v.stint.manager] ?? "—"}</td>
          <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmt(v.stint.price)}</td>
          <td className="hidden px-3 py-2 text-right tabular-nums text-slate-600 sm:table-cell">
            {extra === "gws" ? v.gws : fmt(v.min)}
          </td>
          <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmt(v.pts)}</td>
          <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{fmt(v.ratio, 2)}</td>
        </tr>
      ))}
    </StatsTable>
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Gameweek filter */}
      <div className="rounded-2xl border border-sky-100 bg-white/80 p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Gameweeks</span>
          <FilterChip active={allSelected} onClick={() => setSelected(allIds)}>
            All
          </FilterChip>
          {data.gameweeks.map((g) => (
            <FilterChip key={g.id} active={!allSelected && sel.has(g.id)} onClick={() => toggle(g.id)}>
              {g.label}
            </FilterChip>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Showing {selLabel}. Tap gameweeks to combine them. Updated when a gameweek&apos;s points are published.
        </p>
      </div>

      <StatsCard title="Top points" help="Most points across the selected gameweeks.">
        {pointsTable(stats.top)}
      </StatsCard>

      <StatsCard
        title="Points per 90 minutes"
        help={`Points per 90 minutes played across the selected gameweeks. Only players with at least ${MIN_MINUTES_PER_90} minutes are ranked.`}
      >
        <StatsTable head={["#", "Player", "Club", "Pos", "Mins", "Pts", "Per 90"]} hideOnPhone={[2, 5]} empty={stats.per90.length === 0}>
          {stats.per90.map((t, i) => (
            <tr key={t.player.id} className="border-t border-slate-100">
              <td className="px-3 py-2 tabular-nums text-slate-400">{i + 1}</td>
              <PlayerCell p={t.player} />
              <ClubCell p={t.player} />
              <td className="px-3 py-2">
                <PositionPill position={t.player.pos} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmt(t.min)}</td>
              <td className="hidden px-3 py-2 text-right tabular-nums text-slate-600 sm:table-cell">{fmt(t.pts)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{fmt(t.p90, 1)}</td>
            </tr>
          ))}
        </StatsTable>
      </StatsCard>

      <StatsCard
        title="Best value signings"
        help="Points per 1m of purchase price, for players bought in this auction. Only counts the gameweeks the manager owned the player (in their squad when the gameweek locked)."
      >
        {valueTable(stats.value, "gws")}
      </StatsCard>

      <StatsCard
        title="Worst value signings"
        help={`Lowest points per 1m, using the price the player was first bought for (a transfer does not change it). Only counts the gameweeks the manager owned the player, and only players with at least ${MIN_MINUTES_WORST_VALUE} minutes and some points for that manager.`}
      >
        {valueTable(stats.worst, "mins")}
      </StatsCard>

      <StatsCard
        title="Top free agents"
        help="Highest-scoring players in the selected gameweeks who are not in anyone's squad in this auction right now."
      >
        {pointsTable(stats.freeAgents)}
      </StatsCard>

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-2">
        <StatsCard title="Top goalkeepers" help="Top 5 by points. Positions are listed positions, not where they played in a match.">
          {pointsTable(stats.gk, false)}
        </StatsCard>
        <StatsCard title="Top defenders" help="Top 10 by points. Positions are listed positions, not where they played in a match.">
          {pointsTable(stats.def, false)}
        </StatsCard>
        <StatsCard title="Top midfielders" help="Top 10 by points. Positions are listed positions, not where they played in a match.">
          {pointsTable(stats.mid, false)}
        </StatsCard>
        <StatsCard title="Top forwards" help="Top 10 by points. Positions are listed positions, not where they played in a match.">
          {pointsTable(stats.fwd, false)}
        </StatsCard>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full bg-gradient-to-r from-sky-500 to-sky-600 px-3 py-1 text-sm font-semibold text-white shadow-sm"
          : "rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-sky-50"
      }
    >
      {children}
    </button>
  );
}

function StatsCard({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-sky-400 to-sky-600" />
      <div className="flex items-center gap-2 px-4 pb-1 pt-3 sm:px-5">
        <h3 className="font-display text-base font-semibold uppercase tracking-wide text-slate-900">{title}</h3>
        <InfoTip text={help} label={`About ${title.toLowerCase()}`} />
      </div>
      <div className="overflow-x-auto pb-2">{children}</div>
    </section>
  );
}

function StatsTable({
  head,
  hideOnPhone = [],
  empty,
  children,
}: {
  head: string[];
  /** Column indexes hidden below the sm breakpoint. */
  hideOnPhone?: number[];
  empty: boolean;
  children: React.ReactNode;
}) {
  const numeric = new Set(["Apps", "Pts", "Mins", "Per 90", "Price", "GWs", "Pts/m"]);
  if (empty) return <p className="px-4 py-3 text-sm text-slate-500 sm:px-5">No players for the selected gameweeks.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
          {head.map((h, i) => (
            <th
              key={h}
              className={`px-3 py-2 font-semibold ${numeric.has(h) ? "text-right" : ""} ${hideOnPhone.includes(i) ? "hidden sm:table-cell" : ""}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

