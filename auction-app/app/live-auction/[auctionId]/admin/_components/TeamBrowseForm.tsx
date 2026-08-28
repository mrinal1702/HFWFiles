"use client";

import { useActionState, useState, useEffect } from "react";

import type {
  LiveAuctionParticipant,
  PlayerWithSaleInfo,
  RecordSaleState,
  EditSaleState,
} from "@/lib/live-auction-types";

type Props = {
  allPlayers: PlayerWithSaleInfo[];
  participants: LiveAuctionParticipant[];
  recordSale: (prevState: RecordSaleState, formData: FormData) => Promise<RecordSaleState>;
  editSale: (prevState: EditSaleState, formData: FormData) => Promise<EditSaleState>;
};

export function TeamBrowseForm({ allPlayers, participants, recordSale, editSale }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  // Group all players by team name, preserving order within each team
  const teamMap: Record<string, PlayerWithSaleInfo[]> = {};
  for (const p of allPlayers) {
    const team = p.team_name ?? p.nation ?? "Unknown";
    if (!teamMap[team]) teamMap[team] = [];
    teamMap[team].push(p);
  }
  const teams = Object.keys(teamMap).sort();
  const teamPlayers = selectedTeam ? (teamMap[selectedTeam] ?? []) : [];

  const availableCount = teamPlayers.filter((p) => p.status === "available").length;
  const soldCount = teamPlayers.filter((p) => p.sale_id !== null).length;
  const unsoldCount = teamPlayers.filter((p) => p.status === "unsold").length;

  return (
    <div className="space-y-4">
      {/* Team selector */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Team</label>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
        >
          <option value="">Select a team…</option>
          {teams.map((team) => {
            const players = teamMap[team];
            const sold = players.filter((p) => p.sale_id !== null).length;
            const available = players.filter((p) => p.status === "available").length;
            return (
              <option key={team} value={team}>
                {team} — {available} available, {sold} sold
              </option>
            );
          })}
        </select>
      </div>

      {/* Player list */}
      {selectedTeam && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-slate-700">{selectedTeam}</span>
            <span>
              {availableCount} available · {soldCount} sold
              {unsoldCount > 0 ? ` · ${unsoldCount} passed` : ""}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 divide-y divide-slate-100">
            {teamPlayers.length === 0 && (
              <p className="px-4 py-4 text-sm text-slate-500">No players for this team.</p>
            )}
            {teamPlayers.map((player) => {
              if (player.sale_id !== null) {
                return (
                  <SoldPlayerRow
                    key={player.id}
                    player={player}
                    participants={participants}
                    editSale={editSale}
                  />
                );
              }
              if (player.status === "unsold") {
                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between bg-slate-50 px-4 py-3 opacity-60"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-500 line-through">
                        {player.player_name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{player.position ?? "—"}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-400">Passed</span>
                  </div>
                );
              }
              // status === "available"
              return (
                <AvailablePlayerRow
                  key={player.id}
                  player={player}
                  participants={participants}
                  recordSale={recordSale}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Available player row ─────────────────────────────────────────────────────

function AvailablePlayerRow({
  player,
  participants,
  recordSale,
}: {
  player: PlayerWithSaleInfo;
  participants: LiveAuctionParticipant[];
  recordSale: (prevState: RecordSaleState, formData: FormData) => Promise<RecordSaleState>;
}) {
  const [state, formAction, pending] = useActionState(recordSale, null);

  const hasError =
    !state?.success &&
    (!!state?.error || !!state?.fieldErrors?.playerId || !!state?.fieldErrors?.price || !!state?.fieldErrors?.participantId);

  return (
    <div className="bg-white px-4 py-3">
      {/* Player name + position */}
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-slate-900">{player.player_name}</p>
        <span className="ml-3 shrink-0 text-xs text-slate-400">{player.position ?? "—"}</span>
      </div>

      {/* Error messages */}
      {hasError && (
        <p className="mb-2 text-xs text-red-600">
          {state?.error ??
            state?.fieldErrors?.playerId ??
            state?.fieldErrors?.price ??
            state?.fieldErrors?.participantId}
        </p>
      )}

      {/* Inline sale form: owner + price + Sell button */}
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="playerId" value={player.id} />

        <select
          name="participantId"
          defaultValue=""
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
        >
          <option value="" disabled>
            Owner…
          </option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>

        <div className="relative shrink-0">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            £
          </span>
          <input
            type="number"
            name="price"
            min="5"
            step="1"
            placeholder="0"
            className="w-20 rounded-lg border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-sm text-slate-900 placeholder-slate-300 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "…" : "Sell"}
        </button>
      </form>
    </div>
  );
}

// ─── Sold player row ──────────────────────────────────────────────────────────

function SoldPlayerRow({
  player,
  participants,
  editSale,
}: {
  player: PlayerWithSaleInfo;
  participants: LiveAuctionParticipant[];
  editSale: (prevState: EditSaleState, formData: FormData) => Promise<EditSaleState>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(editSale, null);

  useEffect(() => {
    if (state?.success) setEditing(false);
  }, [state?.success]);

  return (
    <div className="bg-slate-50/60 px-4 py-3">
      {/* Summary row */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{player.player_name}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {player.position ?? "—"} ·{" "}
            <span className="font-medium text-slate-600">{player.sold_to_name}</span>
            {" · "}
            <span className="font-mono font-semibold text-slate-700">£{player.sale_price}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-semibold text-green-700">✓ Sold</span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs font-medium text-sky-700 hover:underline"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      {/* Inline edit form */}
      {editing && (
        <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="saleId" value={player.sale_id ?? ""} />

          <select
            name="participantId"
            defaultValue={player.sold_to_participant_id ?? ""}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
          >
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>

          <div className="relative shrink-0">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              £
            </span>
            <input
              type="number"
              name="price"
              min="5"
              step="1"
              defaultValue={player.sale_price ?? 5}
              className="w-20 rounded-lg border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {pending ? "…" : "Save"}
          </button>

          {state?.error && (
            <p className="w-full text-xs text-red-600">{state.error}</p>
          )}
        </form>
      )}
    </div>
  );
}
