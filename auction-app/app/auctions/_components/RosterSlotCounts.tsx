import { remainingBidSlots, SQUAD_LIMIT } from "@/lib/squad-limit";

type Props = {
  owned: number;
  bidsHeld: number;
  /** When true, omit "can still bid" (e.g. bidding already closed). */
  hideRemaining?: boolean;
};

export function RosterSlotCounts({ owned, bidsHeld, hideRemaining = false }: Props) {
  const remaining = remainingBidSlots(owned, bidsHeld);

  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">
      <div className="rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2">
        <div className="text-xs font-medium text-slate-600">Players owned</div>
        <div className="font-mono text-base tabular-nums text-slate-900">
          {owned}
          <span className="ml-1 text-xs font-normal text-slate-500">/ {SQUAD_LIMIT}</span>
        </div>
      </div>
      <div className="rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2">
        <div className="text-xs font-medium text-slate-600">Bids held</div>
        <div className="font-mono text-base tabular-nums text-slate-900">{bidsHeld}</div>
      </div>
      {!hideRemaining && (
        <div className="col-span-2 rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2 sm:col-span-1">
          <div className="text-xs font-medium text-slate-600">Can still bid on</div>
          <div className="font-mono text-base tabular-nums text-slate-900">{remaining}</div>
        </div>
      )}
    </div>
  );
}
