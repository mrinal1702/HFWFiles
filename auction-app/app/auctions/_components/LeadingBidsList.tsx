import Link from "next/link";

import { LocalTime } from "@/app/auctions/_components/LocalTime";
import { PositionPill, positionTheme } from "@/app/auctions/_components/position-theme";
import type { EnrichedLot } from "@/lib/auction-types";

/**
 * Bids currently being won, as position-tinted cards (Bidding room style).
 * Used by Bids held (mine) and Competitors – Bidding detail (theirs).
 */
export function LeadingBidsList({
  lots,
  playerHref,
  bidLabel = "Bid",
}: {
  lots: EnrichedLot[];
  playerHref: (playerId: string) => string;
  /** Column / row label for the amount, e.g. "Your bid". */
  bidLabel?: string;
}) {
  return (
    <>
      <ul className="space-y-2 md:hidden">
        {lots.map((l) => {
          const t = positionTheme(l.position);
          return (
            <li
              key={l.player_id}
              className={`relative overflow-hidden rounded-xl border py-3 pl-4 pr-3 shadow-sm ${t.card}`}
            >
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${t.stripe}`} />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-display text-base font-semibold tracking-[0.01em] text-slate-900">
                  <Link href={playerHref(l.player_id)} className="hover:underline">
                    {l.player_name ?? "—"}
                  </Link>
                </h4>
                <span className="font-mono text-base font-semibold tabular-nums text-slate-900">
                  <span className="sr-only">{bidLabel}: </span>
                  {l.high_amount ?? "—"}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                <span>{l.club ?? "—"}</span>
                <PositionPill position={l.position} />
              </p>
              <p className="mt-2 flex justify-between gap-3 rounded-lg bg-white/80 px-2 py-1.5 text-xs ring-1 ring-black/5">
                <span className="text-slate-600">Timer</span>
                <span className="text-right text-slate-700">
                  <LocalTime iso={l.expires_at} />
                </span>
              </p>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[36rem] border-separate border-spacing-y-1.5 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Player</th>
              <th className="px-3 py-2 font-semibold">Club</th>
              <th className="px-3 py-2 font-semibold">Pos</th>
              <th className="px-3 py-2 font-semibold">{bidLabel}</th>
              <th className="px-3 py-2 font-semibold">Timer (local)</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((l) => (
              <tr
                key={l.player_id}
                className={`[&>td]:border-y [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l-[6px] [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r ${positionTheme(l.position).row}`}
              >
                <td className="px-3 py-2.5 font-display text-[15px] font-semibold tracking-[0.01em] text-slate-900">
                  <Link href={playerHref(l.player_id)} className="hover:underline">
                    {l.player_name ?? "—"}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{l.club ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <PositionPill position={l.position} />
                </td>
                <td className="px-3 py-2.5 font-mono text-base font-semibold tabular-nums text-slate-900">
                  {l.high_amount ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-600">
                  <LocalTime iso={l.expires_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
