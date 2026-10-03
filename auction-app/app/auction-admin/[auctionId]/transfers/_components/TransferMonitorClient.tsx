"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AdminActionState } from "../../actions";

type PendingPlayer = {
  player_id: string;
  player_name: string | null;
  position: string | null;
};

export type PendingTransfer = {
  id: string;
  proposerName: string;
  recipientName: string;
  proposerPlayers: PendingPlayer[];
  proposerCash: number;
  recipientPlayers: PendingPlayer[];
  recipientCash: number;
};

type AdminAction = (
  prevState: AdminActionState,
  formData: FormData,
) => Promise<AdminActionState>;

function SideSummary({
  name,
  players,
  cash,
}: {
  name: string;
  players: PendingPlayer[];
  cash: number;
}) {
  const nothing = players.length === 0 && cash <= 0;
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{name} sends:</p>
      {nothing ? (
        <p className="mt-1 text-sm text-slate-500">Nothing</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {players.map((p) => (
            <li key={p.player_id} className="text-sm text-slate-700">
              {p.player_name ?? p.player_id}
              {p.position ? (
                <span className="text-xs text-slate-500"> · {p.position}</span>
              ) : null}
            </li>
          ))}
          {cash > 0 ? (
            <li className="text-sm font-medium text-slate-700">£{cash}</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

export function TransferMonitorClient({
  approvalOn,
  pendingTransfers,
  setApproval,
  approveTransfer,
  rejectTransfer,
}: {
  approvalOn: boolean;
  pendingTransfers: PendingTransfer[];
  setApproval: AdminAction;
  approveTransfer: AdminAction;
  rejectTransfer: AdminAction;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOn, setConfirmOn] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyApproval(value: boolean) {
    setError(null);
    const formData = new FormData();
    formData.set("require_approval", value ? "true" : "false");
    startTransition(async () => {
      const res = await setApproval(null, formData);
      setConfirmOn(false);
      if (res?.ok) {
        setBanner(res.message ?? "Updated.");
        router.refresh();
      } else {
        setError(res?.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  function toggle() {
    setBanner(null);
    if (approvalOn) {
      // Turning OFF applies immediately.
      applyApproval(false);
    } else {
      // Turning ON asks for confirmation first.
      setConfirmOn(true);
    }
  }

  function decide(transferId: string, action: AdminAction) {
    setBanner(null);
    setError(null);
    setActingId(transferId);
    const formData = new FormData();
    formData.set("transferId", transferId);
    startTransition(async () => {
      const res = await action(null, formData);
      setActingId(null);
      if (res?.ok) {
        setBanner(res.message ?? "Done.");
        router.refresh();
      } else {
        setError(res?.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {banner && (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          {banner}
        </div>
      )}

      {/* Admin permission switch */}
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Admin Permission Before Transfers</p>
            <p className="mt-1 text-xs text-slate-500">
              {approvalOn
                ? "ON — every transfer requires your approval before it goes through."
                : "OFF — transfers complete without your approval."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={approvalOn}
            aria-label="Admin Permission Before Transfers"
            onClick={toggle}
            disabled={isPending}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              approvalOn ? "bg-sky-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                approvalOn ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Transfers for approval */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">Transfers for Approval</h3>
        {pendingTransfers.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            {approvalOn
              ? "No transfers are waiting for approval right now."
              : "Admin approval is off, so no transfers are waiting for approval."}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pendingTransfers.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-sky-100 bg-white px-4 py-4 shadow-sm"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <SideSummary
                    name={t.proposerName}
                    players={t.proposerPlayers}
                    cash={t.proposerCash}
                  />
                  <SideSummary
                    name={t.recipientName}
                    players={t.recipientPlayers}
                    cash={t.recipientCash}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => decide(t.id, approveTransfer)}
                    disabled={isPending}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                  >
                    {isPending && actingId === t.id ? "Working…" : "Allow"}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(t.id, rejectTransfer)}
                    disabled={isPending}
                    className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {isPending && actingId === t.id ? "Working…" : "Disallow"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirm turning ON */}
      {confirmOn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Cancel"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setConfirmOn(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-sky-100 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              Are you sure you want to turn admin permission on?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Transfers will require admin approval to go through.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOn(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => applyApproval(true)}
                disabled={isPending}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
              >
                {isPending ? "Turning on…" : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result / error modal */}
      {error && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setError(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-red-100 bg-white p-5 shadow-xl">
            <p className="text-sm text-slate-800" role="alert">
              {error}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
