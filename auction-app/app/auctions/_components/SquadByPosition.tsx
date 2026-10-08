import Link from "next/link";
import type { ReactNode } from "react";

import { POSITION_THEME, PositionPill } from "@/app/auctions/_components/position-theme";

/**
 * Owned squad as one list grouped by position (coloured headings with counts), each player a
 * separate card tinted by position. Used by My team and Competitors – Bidding detail.
 */
export type SquadPlayer = {
  player_id: string;
  player_name: string | null;
  club: string | null;
  position: string | null;
  price: number | null;
};

type SectionId = "gk" | "def" | "mid" | "fwd" | "other";

const SECTIONS: Array<{ id: SectionId; label: string; theme: (typeof POSITION_THEME)[number] }> = [
  { id: "gk", label: "Goalkeepers", theme: POSITION_THEME[0] },
  { id: "def", label: "Defenders", theme: POSITION_THEME[1] },
  { id: "mid", label: "Midfielders", theme: POSITION_THEME[2] },
  { id: "fwd", label: "Forwards", theme: POSITION_THEME[3] },
  { id: "other", label: "Other", theme: POSITION_THEME[4] },
];

function sectionForPosition(position: string | null | undefined): SectionId {
  const p = (position ?? "").trim().toLowerCase();
  if (p === "gk" || p.includes("goalkeeper")) return "gk";
  if (p.includes("defend")) return "def";
  if (p.includes("midfield")) return "mid";
  if (p.includes("forward")) return "fwd";
  return "other";
}

export function SquadByPosition({
  players,
  playerHref,
  renderAction,
}: {
  players: SquadPlayer[];
  playerHref: (playerId: string) => string;
  /** Optional trailing control per player (e.g. Release on My team). */
  renderAction?: (player: SquadPlayer) => ReactNode;
}) {
  const groups = SECTIONS.map((section) => ({
    ...section,
    rows: players
      .filter((p) => sectionForPosition(p.position) === section.id)
      .sort((a, b) => {
        const clubA = (a.club ?? "").toLowerCase();
        const clubB = (b.club ?? "").toLowerCase();
        if (clubA !== clubB) return clubA.localeCompare(clubB);
        const nameA = (a.player_name ?? "").toLowerCase();
        const nameB = (b.player_name ?? "").toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.player_id.localeCompare(b.player_id);
      }),
  })).filter((g) => g.rows.length > 0);
  const cols = renderAction ? 5 : 4;

  const heading = (g: (typeof groups)[number]) => (
    <span
      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${g.theme.heading}`}
    >
      {g.label} ({g.rows.length})
    </span>
  );

  return (
    <>
      {/* Phones: cards */}
      <div className="space-y-4 md:hidden">
        {groups.map((g) => (
          <div key={g.id}>
            <h3>{heading(g)}</h3>
            <ul className="mt-2 space-y-2">
              {g.rows.map((p) => (
                <li
                  key={p.player_id}
                  className={`relative overflow-hidden rounded-xl border py-3 pl-4 pr-3 shadow-sm ${g.theme.card}`}
                >
                  <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${g.theme.stripe}`} />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-display text-base font-semibold tracking-[0.01em] text-slate-900">
                      <Link href={playerHref(p.player_id)} className="hover:underline">
                        {p.player_name ?? "—"}
                      </Link>
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-semibold tabular-nums text-slate-900">
                        {p.price ?? "—"}
                      </span>
                      {renderAction?.(p)}
                    </div>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
                    <span>{p.club ?? "—"}</span>
                    <PositionPill position={p.position} />
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Desktop: one table, separated position-tinted rows */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[28rem] border-separate border-spacing-y-1.5 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Player</th>
              <th className="px-3 py-2 font-semibold">Club</th>
              <th className="px-3 py-2 font-semibold">Pos</th>
              <th className="px-3 py-2 font-semibold">Price</th>
              {renderAction && <th className="px-3 py-2 font-semibold" />}
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((g, gi) => [
              <tr key={`${g.id}-header`}>
                <td colSpan={cols} className={`px-1 pb-0.5 ${gi === 0 ? "pt-0" : "pt-3"}`}>
                  {heading(g)}
                </td>
              </tr>,
              ...g.rows.map((p) => (
                <tr
                  key={p.player_id}
                  className={`[&>td]:border-y [&>td:first-child]:rounded-l-xl [&>td:first-child]:border-l-[6px] [&>td:last-child]:rounded-r-xl [&>td:last-child]:border-r ${g.theme.row}`}
                >
                  <td className="px-3 py-2.5 font-display text-[15px] font-semibold tracking-[0.01em] text-slate-900">
                    <Link href={playerHref(p.player_id)} className="hover:underline">
                      {p.player_name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{p.club ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <PositionPill position={p.position} />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-base font-semibold tabular-nums text-slate-900">
                    {p.price ?? "—"}
                  </td>
                  {renderAction && <td className="px-3 py-2.5 text-right">{renderAction(p)}</td>}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </>
  );
}
