import { remainingBidSlots, SQUAD_LIMIT } from "@/lib/auction-state/squad-limit";

type Props = {
  owned: number;
  bidsHeld: number;
  /** When true, omit "can still bid" (e.g. bidding already closed). */
  hideRemaining?: boolean;
};

export function RosterSlotCounts({ owned, bidsHeld, hideRemaining = false }: Props) {
  const remaining = remainingBidSlots(owned, bidsHeld);

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
      <div className="rounded-xl border border-sky-200 bg-white px-3 py-1.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Players owned</div>
        <div className="font-mono text-lg font-semibold leading-tight tabular-nums text-slate-900">
          {owned}
          <span className="ml-1 text-xs font-normal text-slate-500">/ {SQUAD_LIMIT}</span>
        </div>
      </div>
      <div className="rounded-xl border border-sky-200 bg-white px-3 py-1.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Bids held</div>
        <div className="font-mono text-lg font-semibold leading-tight tabular-nums text-slate-900">{bidsHeld}</div>
      </div>
      {!hideRemaining && (
        <div className="col-span-2 rounded-xl border border-sky-200 bg-white px-3 py-1.5 sm:col-span-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Can still bid on</div>
          <div className="font-mono text-lg font-semibold leading-tight tabular-nums text-slate-900">{remaining}</div>
        </div>
      )}
    </div>
  );
}
