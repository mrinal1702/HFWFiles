"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { proposeTransferAction, type TransferActionState } from "@/app/auctions/[auctionId]/transfers/actions";

type SquadPlayer = {
  player_id: string;
  player_name: string | null;
  position: string | null;
  club: string | null;
  locked: boolean;
};

type OtherTeam = {
  id: number;
  name: string | null;
};

export function ProposeTransferClient({
  auctionId,
  mySquad,
  otherTeams,
}: {
  auctionId: number;
  mySquad: SquadPlayer[];
  otherTeams: OtherTeam[];
}) {
  const router = useRouter();
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [cash, setCash] = useState("");

  const [state, formAction, pending] = useActionState<TransferActionState, FormData>(
    async (prev: TransferActionState, fd: FormData) => {
      const result = await proposeTransferAction(prev, fd);
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

  const inputCls =
    "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25";

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="auction_id" value={auctionId} />

      {/* Hidden inputs for selected players */}
      {Array.from(selectedPlayerIds).map((pid) => (
        <input key={pid} type="hidden" name="proposer_player_ids" value={pid} />
      ))}

      {/* Team selection */}
      <div>
        <label htmlFor="recipient_id" className="block text-sm font-medium text-slate-700">
          Propose to
        </label>
        <select
          id="recipient_id"
          name="recipient_id"
          required
          defaultValue=""
          className={`mt-1 ${inputCls}`}
        >
          <option value="" disabled>
            Select a manager…
          </option>
          {otherTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name ?? `Team #${t.id}`}
            </option>
          ))}
        </select>
      </div>

      {/* Player selection */}
      <div>
        <p className="text-sm font-medium text-slate-700">
          Your players to offer{" "}
          <span className="text-slate-400 font-normal">(select any, or none if cash-only)</span>
        </p>
        {mySquad.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">You have no players in your squad yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {mySquad.map((p) => {
              const checked = selectedPlayerIds.has(p.player_id);
              return (
                <li key={p.player_id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      p.locked
                        ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                        : checked
                        ? "border-sky-300 bg-sky-50 text-slate-900"
                        : "border-slate-200 bg-white text-slate-800 hover:border-sky-200 hover:bg-sky-50/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={p.locked}
                      checked={checked}
                      onChange={() => togglePlayer(p.player_id)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600"
                    />
                    <span className="flex-1 font-medium">{p.player_name ?? "—"}</span>
                    <span className="text-xs text-slate-400">
                      {[p.position, p.club].filter(Boolean).join(" · ")}
                    </span>
                    {p.locked && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                        In transfer
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Cash */}
      <div>
        <label htmlFor="proposer_cash" className="block text-sm font-medium text-slate-700">
          Cash to offer{" "}
          <span className="text-slate-400 font-normal">(£m, whole number — leave blank for none)</span>
        </label>
        <input
          id="proposer_cash"
          name="proposer_cash"
          type="number"
          inputMode="numeric"
          step={1}
          min={0}
          value={cash}
          onChange={(e) => setCash(e.target.value)}
          placeholder="0"
          className={`mt-1 max-w-[10rem] ${inputCls}`}
        />
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {pending ? "Proposing…" : "Propose transfer"}
        </button>
        <a
          href={`/auctions/${auctionId}/transfers`}
          className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </a>
      </div>

      {state && !state.ok && (
        <p role="status" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
