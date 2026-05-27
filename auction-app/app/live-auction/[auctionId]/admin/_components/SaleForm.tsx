"use client";

import { useActionState, useState, useEffect, useRef, useMemo } from "react";

import type {
  LiveAuctionPlayer,
  LiveAuctionParticipant,
  RecordSaleState,
} from "@/lib/live-auction-types";

type Props = {
  players: LiveAuctionPlayer[];
  participants: LiveAuctionParticipant[];
  recordSale: (prevState: RecordSaleState, formData: FormData) => Promise<RecordSaleState>;
};

export function SaleForm({ players, participants, recordSale }: Props) {
  const [state, formAction, pending] = useActionState(recordSale, null);

  // Local UI state for the player search
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<LiveAuctionPlayer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  // Whether the admin has acknowledged the soft budget warning
  const [overrideWarning, setOverrideWarning] = useState(false);
  // Shown briefly after a successful sale
  const [flashSuccess, setFlashSuccess] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const participantRef = useRef<HTMLSelectElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  // Reset form on success
  useEffect(() => {
    if (state?.success) {
      setSearch("");
      setSelectedPlayer(null);
      setOverrideWarning(false);
      setShowDropdown(false);
      formRef.current?.reset();
      setFlashSuccess(true);
      const t = setTimeout(() => setFlashSuccess(false), 3500);
      return () => clearTimeout(t);
    }
  }, [state?.success]);

  // Clear the override flag when a new non-warning state arrives
  useEffect(() => {
    if (!state?.warning) setOverrideWarning(false);
  }, [state?.warning]);

  // Filter players by search query (client-side — all available players are pre-loaded)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return players
      .filter(
        (p) =>
          p.player_name.toLowerCase().includes(q) ||
          (p.team_name ?? "").toLowerCase().includes(q) ||
          (p.nation ?? "").toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [search, players]);

  const selectPlayer = (p: LiveAuctionPlayer) => {
    setSelectedPlayer(p);
    setSearch("");
    setShowDropdown(false);
    // Move focus to participant dropdown for fast entry
    setTimeout(() => participantRef.current?.focus(), 0);
  };

  const clearPlayer = () => {
    setSelectedPlayer(null);
    setSearch("");
  };

  return (
    <div className="space-y-5">
      {/* Success flash */}
      {flashSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          ✓ Sale recorded successfully.
        </div>
      )}

      {/* General error */}
      {!state?.success && state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      )}

      {/* Soft budget warning — admin must acknowledge before proceeding */}
      {!state?.success && state?.warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-3">
          <p className="font-medium">Budget warning</p>
          <p className="leading-relaxed">{state.warning}</p>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={overrideWarning}
              onChange={(e) => setOverrideWarning(e.target.checked)}
              className="h-4 w-4 rounded border-amber-400 accent-amber-600"
            />
            <span className="text-sm">I understand — proceed anyway</span>
          </label>
        </div>
      )}

      <form ref={formRef} action={formAction} className="space-y-5">
        {/* Hidden field — tells the server whether the admin acknowledged the warning */}
        <input type="hidden" name="overrideWarning" value={overrideWarning ? "true" : "false"} />

        {/* ── Player search ─────────────────────────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Player</label>
          <input type="hidden" name="playerId" value={selectedPlayer?.id ?? ""} />

          {selectedPlayer ? (
            // Selected state: show player chip with clear button
            <div className="flex items-center justify-between rounded-lg border border-sky-300 bg-sky-50 px-3 py-2.5">
              <div>
                <span className="text-sm font-medium text-slate-900">{selectedPlayer.player_name}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {selectedPlayer.team_name ?? selectedPlayer.nation ?? ""}
                  {selectedPlayer.position ? ` · ${selectedPlayer.position}` : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={clearPlayer}
                className="ml-3 text-xs text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            </div>
          ) : (
            // Search state: text input with dropdown
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder="Search by name or team…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                autoComplete="off"
              />
              {showDropdown && filtered.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filtered.map((p) => (
                    <li
                      key={p.id}
                      onMouseDown={() => selectPlayer(p)}
                      className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm hover:bg-sky-50"
                    >
                      <span className="font-medium text-slate-900">{p.player_name}</span>
                      <span className="ml-4 shrink-0 text-xs text-slate-500">
                        {p.team_name ?? p.nation ?? ""}
                        {p.position ? ` · ${p.position}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {showDropdown && search.trim().length > 0 && filtered.length === 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500 shadow-lg">
                  No available players match &quot;{search}&quot;
                </div>
              )}
            </div>
          )}

          {!state?.success && state?.fieldErrors?.playerId && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.playerId}</p>
          )}
        </div>

        {/* ── Participant ───────────────────────────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Participant</label>
          <select
            ref={participantRef}
            name="participantId"
            defaultValue=""
            onKeyDown={(e) => {
              // Tab/Enter from participant moves to price
              if (e.key === "Enter") {
                e.preventDefault();
                priceRef.current?.focus();
              }
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
          >
            <option value="" disabled>
              Select participant…
            </option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
          {!state?.success && state?.fieldErrors?.participantId && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.participantId}</p>
          )}
        </div>

        {/* ── Price ─────────────────────────────────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Sale Price (£)</label>
          <input
            ref={priceRef}
            type="number"
            name="price"
            min="1"
            step="1"
            placeholder="e.g. 45"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
          {!state?.success && state?.fieldErrors?.price && (
            <p className="mt-1 text-xs text-red-600">{state.fieldErrors.price}</p>
          )}
        </div>

        {/* ── Submit ────────────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={pending || !selectedPlayer || (!!state?.warning && !overrideWarning)}
          className="w-full rounded-lg bg-sky-600 px-4 py-3 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Recording…" : state?.warning ? "Confirm Sale (warning acknowledged)" : "Confirm Sale"}
        </button>
      </form>
    </div>
  );
}
