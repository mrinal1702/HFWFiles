"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { respondToTransferAction, type TransferActionState } from "@/app/auctions/[auctionId]/transfers/actions";

type SquadPlayer = {
  player_id: string;
  player_name: string | null;
  position: string | null;
  club: string | null;
  locked: boolean;
};

type ProposerPlayer = {
  player_id: string;
  player_name: string | null;
  position: string | null;
};

export function RespondTransferClient({
  auctionId,
  transferId,
  proposerName,
  proposerPlayers,
  proposerCash,
  proposerBudget,
  mySquad,
  myName,
  myBudget,
}: {
  auctionId: number;
  transferId: string;
  proposerName: string;
  proposerPlayers: ProposerPlayer[];
  proposerCash: number;
  proposerBudget: { budget_remaining: number; active_budget: number };
  mySquad: SquadPlayer[];
  myName: string;
  myBudget: { budget_remaining: number; active_budget: number };
}) {
  const router = useRouter();
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [cash, setCash] = useState("");

  const [state, formAction, pending] = useActionState<TransferActionState, FormData>(
    async (prev: TransferActionState, fd: FormData) => {
      const result = await respondToTransferAction(prev, fd);
      if (result?.ok) {
        router.push(`/auctions/${auctionId}/transfers`);
      }
      return result;
    },
    null,
  );

  function togglePlayer(pid: string) {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  const offeredPlayers = mySquad.filter((p) => selectedPlayerIds.has(p.player_id));
  const cashNum = Math.max(0, parseInt(cash || "0", 10) || 0);
  const hasOffer = offeredPlayers.length > 0 || cashNum > 0;

  const hasProposerOffer = proposerPlayers.length > 0 || proposerCash > 0;

  return (
    <section className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2 text-sm">
          <a
            href={`/auctions/${auctionId}/transfers`}
            className="font-medium text-sky-600 hover:text-sky-800"
          >
            ← Transfer Room
          </a>
        </div>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          Respond to {proposerName}&apos;s proposal
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Review what {proposerName} is offering on the left. Select players from your squad on the
          right to complete the deal. Once you send your offer, both parties will confirm.
        </p>
      </div>

      {/* Budget strip */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <BudgetCard
          label={proposerName}
          total={proposerBudget.budget_remaining}
          available={proposerBudget.active_budget}
        />
        <div className="text-center text-xl text-slate-300 select-none">⇄</div>
        <BudgetCard
          label={`${myName} (You)`}
          total={myBudget.budget_remaining}
          available={myBudget.active_budget}
        />
      </div>

      {/* Side-by-side panels */}
      <form action={formAction}>
        <input type="hidden" name="auction_id" value={auctionId} />
        <input type="hidden" name="transfer_id" value={transferId} />
        {Array.from(selectedPlayerIds).map((pid) => (
          <input key={pid} type="hidden" name="recipient_player_ids" value={pid} />
        ))}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_32px_1fr]">
          {/* Left: proposer's offer (read-only) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 border-b border-slate-100 pb-3">
              <span className="font-semibold text-slate-900">
                {proposerName} — Their offer to you
              </span>
            </div>

            {!hasProposerOffer ? (
              <p className="py-3 text-sm italic text-slate-400">No offer specified.</p>
            ) : (
              <ul className="space-y-1.5">
                {proposerPlayers.map((p) => (
                  <li
                    key={p.player_id}
                    className="flex items-center gap-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm"
                  >
                    <span className="flex-1 font-medium text-slate-900">
                      {p.player_name ?? "—"}
                    </span>
                    {p.position && (
                      <span className="shrink-0 text-xs text-slate-400">{p.position}</span>
                    )}
                  </li>
                ))}
                {proposerCash > 0 && (
                  <li className="flex items-center gap-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm">
                    <span className="flex-1 font-medium text-slate-900">
                      £{proposerCash}m cash
                    </span>
                  </li>
                )}
              </ul>
            )}

            {/* Spacer note */}
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs text-slate-400 italic">
                This is what {proposerName} is sending to you.
              </p>
            </div>
          </div>

          {/* Centre arrow */}
          <div className="hidden items-start justify-center pt-8 md:flex">
            <span className="text-2xl text-slate-200 select-none">⇄</span>
          </div>

          {/* Right: my squad (selectable) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="font-semibold text-slate-900">{myName} — Your offer in return</span>
              {selectedPlayerIds.size > 0 && (
                <span className="text-xs font-medium text-sky-600">
                  {selectedPlayerIds.size} selected
                </span>
              )}
            </div>

            {mySquad.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                You have no players in your squad.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {mySquad.map((p) => {
                  const checked = selectedPlayerIds.has(p.player_id);
                  const disabled = p.locked;
                  return (
                    <li key={p.player_id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          disabled
                            ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-50"
                            : checked
                            ? "border-sky-300 bg-sky-50"
                            : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={checked}
                          onChange={() => !disabled && togglePlayer(p.player_id)}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600"
                        />
                        <span className="flex-1 font-medium text-slate-900">
                          {p.player_name ?? "—"}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {[p.position, p.club].filter(Boolean).join(" · ")}
                        </span>
                        {p.locked && (
                          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                            In deal
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Cash input */}
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label
                htmlFor="recipient_cash"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Cash to offer (£m)
              </label>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-sm text-slate-400">£</span>
                <input
                  id="recipient_cash"
                  name="recipient_cash"
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={0}
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  placeholder="0"
                  className="w-24 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
                />
                <span className="text-xs text-slate-400">million</span>
              </div>
            </div>
          </div>
        </div>

        {/* Deal summary + submit */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {hasOffer ? (
            <div className="mb-4 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                Deal summary
              </p>
              <p className="mt-1 text-sm text-slate-700">
                <span className="font-medium text-slate-900">{proposerName}</span> sends{" "}
                {hasProposerOffer
                  ? [
                      proposerPlayers.length > 0
                        ? proposerPlayers.map((p) => p.player_name ?? "—").join(", ")
                        : null,
                      proposerCash > 0 ? `£${proposerCash}m` : null,
                    ]
                      .filter(Boolean)
                      .join(" + ")
                  : "nothing"}
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                <span className="font-medium text-slate-900">{myName}</span> sends{" "}
                {[
                  offeredPlayers.length > 0
                    ? offeredPlayers.map((p) => p.player_name ?? "—").join(", ")
                    : null,
                  cashNum > 0 ? `£${cashNum}m` : null,
                ]
                  .filter(Boolean)
                  .join(" + ")}
              </p>
              <p className="mt-1.5 text-xs text-slate-400">
                Both parties must confirm before the transfer executes.
              </p>
            </div>
          ) : (
            <p className="mb-4 text-sm italic text-slate-400">
              Select players from your squad and/or add cash to complete the deal.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!hasOffer || pending}
              className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Sending…" : "Send my offer"}
            </button>
            <a
              href={`/auctions/${auctionId}/transfers`}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </a>
          </div>

          {state && !state.ok && (
            <p role="status" className="mt-3 text-sm text-red-700">
              {state.message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

function BudgetCard({
  label,
  total,
  available,
}: {
  label: string;
  total: number;
  available: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <p className="mb-2 truncate text-xs text-slate-400">{label}</p>
      <div className="flex gap-4">
        <div>
          <p className="text-base font-bold text-slate-800">£{total}m</p>
          <p className="text-xs text-slate-400">total</p>
        </div>
        <div>
          <p className="text-base font-bold text-sky-600">£{available}m</p>
          <p className="text-xs text-slate-400">available</p>
        </div>
      </div>
    </div>
  );
}
