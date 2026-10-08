"use client";

import {
  BENCH_THEME,
  FLEX_THEME,
  POSITION_THEME,
} from "@/app/auctions/_components/position-theme";
import type { GwSquadPlayer } from "@/lib/scoring/leaderboard-data";
import {
  compareXiPlayersForDisplay,
  formatListedPosition,
  formatMatchPosition,
  listedPositionSortKey,
} from "@/lib/scoring/best-xi-display";

type Theme = (typeof POSITION_THEME)[number];

function scoreLabel(player: GwSquadPlayer): string {
  return player.score != null ? String(player.score) : "—";
}

function sortFlatSquad(players: GwSquadPlayer[]): GwSquadPlayer[] {
  return [...players].sort((a, b) => {
    const pa = listedPositionSortKey(a.position);
    const pb = listedPositionSortKey(b.position);
    if (pa !== pb) return pa - pb;
    return (a.playerName ?? "").localeCompare(b.playerName ?? "");
  });
}

/** GK / DEF / MID / FWD / other theme for a short position label. */
function themeForLabel(label: string | null): Theme {
  const i = { GK: 0, DEF: 1, MID: 2, FWD: 3 }[label ?? ""] ?? 4;
  return POSITION_THEME[i];
}

/** Played a different role than listed in this gameweek. */
function isFlexible(p: GwSquadPlayer): boolean {
  const listed = formatListedPosition(p.position);
  const played = formatMatchPosition(p.matchPosition);
  return Boolean(listed && played && listed !== played);
}

/** Card colour: Bench > Flexible > listed position. */
function rowTheme(p: GwSquadPlayer, bench: boolean): Theme {
  if (bench) return BENCH_THEME;
  if (isFlexible(p)) return FLEX_THEME;
  return themeForLabel(formatListedPosition(p.position));
}

function PosPill({ label }: { label: string | null }) {
  if (!label) return <span className="text-slate-400">—</span>;
  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 sm:text-xs ${themeForLabel(label).pill}`}
    >
      {label}
    </span>
  );
}

function SquadTable({ players, bench }: { players: GwSquadPlayer[]; bench: boolean }) {
  return (
    <>
      {/* Phones: cards */}
      <ul className="space-y-2 md:hidden">
        {players.map((p) => {
          const t = rowTheme(p, bench);
          return (
            <li
              key={p.playerId}
              className={`relative overflow-hidden rounded-xl border py-3 pl-4 pr-3 shadow-sm ${t.card}`}
            >
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${t.stripe}`} />
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-base font-semibold tracking-[0.01em] text-slate-900">{p.playerName ?? "—"}</span>
                <span className="font-mono text-base font-semibold tabular-nums text-slate-900">
                  {scoreLabel(p)}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{p.club ?? "—"}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span>Listed</span>
                <PosPill label={formatListedPosition(p.position)} />
                <span className="ml-1">Match</span>
                <PosPill label={formatMatchPosition(p.matchPosition)} />
              </p>
            </li>
          );
        })}
      </ul>

      {/* Desktop: separated rows */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[32rem] border-separate border-spacing-y-1.5 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Player</th>
              <th className="px-3 py-2 font-semibold">Club</th>
              <th className="px-3 py-2 font-semibold">Listed Pos</th>
              <th className="px-3 py-2 font-semibold">Match Pos</th>
              <th className="px-3 py-2 text-right font-semibold">Score</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.playerId}
                className={`[&>td]:border-y [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l-[6px] [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r ${rowTheme(p, bench).row}`}
              >
                <td className="px-3 py-2.5 font-display text-[15px] font-semibold tracking-[0.01em] text-slate-900">{p.playerName ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-600">{p.club ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <PosPill label={formatListedPosition(p.position)} />
                </td>
                <td className="px-3 py-2.5">
                  <PosPill label={formatMatchPosition(p.matchPosition)} />
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-base font-semibold tabular-nums text-slate-900">
                  {scoreLabel(p)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SectionHeading({ label, theme, formation }: { label: string; theme: string; formation?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${theme}`}>
        {label}
      </span>
      {formation && (
        <span className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-bold tabular-nums text-sky-900 ring-1 ring-sky-200">
          {formation}
        </span>
      )}
    </div>
  );
}

/** Colour key so "Flexible" and "Bench" are self-explanatory. */
function ColourKey({ showBench }: { showBench: boolean }) {
  const items: Array<{ label: string; theme: Theme | typeof FLEX_THEME }> = [
    { label: "GK", theme: POSITION_THEME[0] },
    { label: "DEF", theme: POSITION_THEME[1] },
    { label: "MID", theme: POSITION_THEME[2] },
    { label: "FWD", theme: POSITION_THEME[3] },
    { label: "Flexible (played another position)", theme: FLEX_THEME },
    ...(showBench ? [{ label: "Bench", theme: BENCH_THEME }] : []),
  ];
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`h-3 w-3 rounded-sm ${it.theme.stripe}`} />
          {it.label}
        </span>
      ))}
    </p>
  );
}

export function GwSquadTable({
  players,
  formation,
}: {
  players: GwSquadPlayer[];
  formation: string | null;
}) {
  if (players.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No players in this squad yet.</p>;
  }

  const hasBestXiData = players.some((p) => p.isBestXi !== null);

  if (hasBestXiData) {
    const xi = players.filter((p) => p.isBestXi === true).sort(compareXiPlayersForDisplay);
    const bench = players
      .filter((p) => p.isBestXi === false)
      .sort((a, b) => {
        const pa = listedPositionSortKey(a.position);
        const pb = listedPositionSortKey(b.position);
        if (pa !== pb) return pa - pb;
        return (b.score ?? -1) - (a.score ?? -1);
      });

    return (
      <div className="space-y-4">
        <ColourKey showBench={bench.length > 0} />
        <div className="space-y-2">
          <SectionHeading
            label={`Starting XI (${xi.length})`}
            theme="bg-sky-100 text-sky-900 ring-sky-200"
            formation={formation}
          />
          <SquadTable players={xi} bench={false} />
        </div>

        {bench.length > 0 && (
          <div className="space-y-2">
            <SectionHeading label={`Bench (${bench.length})`} theme={BENCH_THEME.heading} />
            <SquadTable players={bench} bench />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ColourKey showBench={false} />
      <SquadTable players={sortFlatSquad(players)} bench={false} />
    </div>
  );
}
