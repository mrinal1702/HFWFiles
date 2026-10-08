import { positionSortRank } from "@/lib/auction-state/bid-ui-messages";

/**
 * Position colour convention for player cards (Bidding room, My team) — change colours here only.
 * Index = positionSortRank: GK, DEF, MID, FWD, other.
 * row = desktop table row (border-separate tables), card = phone card, stripe = phone card left edge,
 * pill = position tag, heading = group heading tag.
 */
export const POSITION_THEME = [
  {
    row: "[&>td]:bg-amber-50 [&>td]:border-amber-200 [&>td:first-child]:border-l-amber-400",
    card: "bg-amber-50 border-amber-200",
    stripe: "bg-amber-400",
    pill: "bg-white text-amber-800 ring-amber-300",
    heading: "bg-amber-100 text-amber-900 ring-amber-200",
  },
  {
    row: "[&>td]:bg-sky-50 [&>td]:border-sky-200 [&>td:first-child]:border-l-sky-400",
    card: "bg-sky-50 border-sky-200",
    stripe: "bg-sky-400",
    pill: "bg-white text-sky-800 ring-sky-300",
    heading: "bg-sky-100 text-sky-900 ring-sky-200",
  },
  {
    row: "[&>td]:bg-emerald-50 [&>td]:border-emerald-200 [&>td:first-child]:border-l-emerald-400",
    card: "bg-emerald-50 border-emerald-200",
    stripe: "bg-emerald-400",
    pill: "bg-white text-emerald-800 ring-emerald-300",
    heading: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  },
  {
    row: "[&>td]:bg-violet-50 [&>td]:border-violet-200 [&>td:first-child]:border-l-violet-400",
    card: "bg-violet-50 border-violet-200",
    stripe: "bg-violet-400",
    pill: "bg-white text-violet-800 ring-violet-300",
    heading: "bg-violet-100 text-violet-900 ring-violet-200",
  },
  {
    row: "[&>td]:bg-slate-50 [&>td]:border-slate-200 [&>td:first-child]:border-l-slate-300",
    card: "bg-slate-50 border-slate-200",
    stripe: "bg-slate-300",
    pill: "bg-white text-slate-600 ring-slate-300",
    heading: "bg-slate-100 text-slate-700 ring-slate-200",
  },
];

export const positionTheme = (position: string | null | undefined) =>
  POSITION_THEME[positionSortRank(position)];

export function PositionPill({ position }: { position: string | null | undefined }) {
  if (!position) return <span className="text-slate-400">—</span>;
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 sm:text-xs ${positionTheme(position).pill}`}
    >
      {position}
    </span>
  );
}
