import Link from "next/link";

import { positionTheme } from "@/app/auctions/_components/position-theme";
import type { MatchScoreRow } from "@/lib/scoring/match-scores/types";

function formatScore(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function positionLabel(position: string): string {
  const p = position.toLowerCase();
  if (p === "goalkeeper") return "GK";
  if (p === "defender") return "DEF";
  if (p === "midfielder") return "MID";
  if (p === "forward") return "FWD";
  return position;
}

/**
 * One match's FinalPoints. Colours follow `row.position` = the position played in THIS match
 * (from the FinalPoints sheet), which can differ from the player's listed position.
 */
export function MatchScoresTable({
  rows,
  auctionId,
  returnTo,
}: {
  rows: MatchScoreRow[];
  /** When set, player names link to the in-auction player page. */
  auctionId?: number;
  /** returnTo query for player page Back button. */
  returnTo?: string;
}) {
  const hrefFor = (row: MatchScoreRow) =>
    auctionId != null
      ? `/auctions/${auctionId}/players/${encodeURIComponent(row.playerId)}${
          returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""
        }`
      : null;

  const name = (row: MatchScoreRow) => {
    const href = hrefFor(row);
    return href ? (
      <Link href={href} prefetch={false} className="hover:underline">
        {row.playerName}
      </Link>
    ) : (
      row.playerName
    );
  };

  const pill = (row: MatchScoreRow) => (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 sm:text-xs ${positionTheme(row.position).pill}`}
    >
      {positionLabel(row.position)}
    </span>
  );

  const score = (row: MatchScoreRow) => (
    <span
      className={`font-mono text-base font-semibold tabular-nums ${row.finalScore < 0 ? "text-rose-600" : "text-slate-900"}`}
    >
      {formatScore(row.finalScore)}
    </span>
  );

  return (
    <>
      {/* Phones: cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row, idx) => {
          const t = positionTheme(row.position);
          return (
            <li
              key={`${row.playerId}-${idx}`}
              className={`relative flex items-center gap-3 overflow-hidden rounded-xl border py-2.5 pl-4 pr-3 shadow-sm ${t.card}`}
            >
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${t.stripe}`} />
              <span className="w-6 shrink-0 font-mono text-xs text-slate-400">{idx + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-semibold tracking-[0.01em] text-slate-900">{name(row)}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                  <span>{row.teamName}</span>
                  {pill(row)}
                </p>
              </div>
              {score(row)}
            </li>
          );
        })}
      </ul>

      {/* Desktop: separated rows */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[32rem] border-separate border-spacing-y-1.5 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="w-10 px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Player</th>
              <th className="px-3 py-2 font-semibold">Team</th>
              <th className="w-20 px-3 py-2 font-semibold">Pos</th>
              <th className="w-20 px-3 py-2 text-right font-semibold">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={`${row.playerId}-${idx}`}
                className={`[&>td]:border-y [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l-[6px] [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r ${positionTheme(row.position).row}`}
              >
                <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{idx + 1}</td>
                <td className="px-3 py-2.5 font-display text-[15px] font-semibold tracking-[0.01em] text-slate-900">{name(row)}</td>
                <td className="px-3 py-2.5 text-slate-600">{row.teamName}</td>
                <td className="px-3 py-2.5">{pill(row)}</td>
                <td className="px-3 py-2.5 text-right">{score(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
