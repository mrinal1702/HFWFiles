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

  // Player search state
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<LiveAuctionPlayer | null>(null);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);

  // Participant combobox state
  const [participantSearch, setParticipantSearch] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState<LiveAuctionParticipant | null>(null);
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);

  const [flashSuccess, setFlashSuccess] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const participantInputRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  // Reset form on success
  useEffect(() => {
    if (state?.success) {
      setSearch("");
      setSelectedPlayer(null);
      setShowPlayerDropdown(false);
      setParticipantSearch("");
      setSelectedParticipant(null);
      setShowParticipantDropdown(false);
      formRef.current?.reset();
      setFlashSuccess(true);
      const t = setTimeout(() => setFlashSuccess(false), 3500);
      return () => clearTimeout(t);
    }
  }, [state?.success]);

  // Filter players by search query (client-side — all available players are pre-loaded)
  const filteredPlayers = useMemo(() => {
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

  // Filter participants by search query
  const filteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) =>
      p.display_name.toLowerCase().includes(q),
    );
  }, [participantSearch, participants]);

  const selectPlayer = (p: LiveAuctionPlayer) => {
    setSelectedPlayer(p);
    setSearch("");
    setShowPlayerDropdown(false);
    // Move focus to participant search for fast entry
    setTimeout(() => participantInputRef.current?.focus(), 0);
  };

  const selectParticipant = (p: LiveAuctionParticipant) => {
    setSelectedParticipant(p);
    setParticipantSearch("");
    setShowParticipantDropdown(false);
    // Move focus to price
    setTimeout(() => priceRef.current?.focus(), 0);
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

      <form ref={formRef} action={formAction} className="space-y-5">
        {/* ── Player search ─────────────────────────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Player</label>
          <input type="hidden" name="playerId" value={selectedPlayer?.id ?? ""} />

          {selectedPlayer ? (
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
                onClick={() => { setSelectedPlayer(null); setSearch(""); }}
                className="ml-3 text-xs text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowPlayerDropdown(true); }}
                onFocus={() => setShowPlayerDropdown(true)}
                onBlur={() => setTimeout(() => setShowPlayerDropdown(false), 150)}
                placeholder="Search by name or team…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                autoComplete="off"
              />
              {showPlayerDropdown && filteredPlayers.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredPlayers.map((p) => (
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
              {showPlayerDropdown && search.trim().length > 0 && filteredPlayers.length === 0 && (
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

        {/* ── Participant combobox ───────────────────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Participant</label>
          <input type="hidden" name="participantId" value={selectedParticipant?.id ?? ""} />

          {selectedParticipant ? (
            <div className="flex items-center justify-between rounded-lg border border-sky-300 bg-sky-50 px-3 py-2.5">
              <span className="text-sm font-medium text-slate-900">{selectedParticipant.display_name}</span>
              <button
                type="button"
                onClick={() => { setSelectedParticipant(null); setParticipantSearch(""); }}
                className="ml-3 text-xs text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                ref={participantInputRef}
                type="text"
                value={participantSearch}
                onChange={(e) => { setParticipantSearch(e.target.value); setShowParticipantDropdown(true); }}
                onFocus={() => setShowParticipantDropdown(true)}
                onBlur={() => setTimeout(() => setShowParticipantDropdown(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredParticipants.length > 0) {
                    e.preventDefault();
                    selectParticipant(filteredParticipants[0]);
                  }
                }}
                placeholder="Search participant…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                autoComplete="off"
              />
              {showParticipantDropdown && filteredParticipants.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredParticipants.map((p) => (
                    <li
                      key={p.id}
                      onMouseDown={() => selectParticipant(p)}
                      className="cursor-pointer px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-sky-50"
                    >
                      {p.display_name}
                    </li>
                  ))}
                </ul>
              )}
              {showParticipantDropdown && participantSearch.trim().length > 0 && filteredParticipants.length === 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500 shadow-lg">
                  No participants match &quot;{participantSearch}&quot;
                </div>
              )}
            </div>
          )}

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
            min="5"
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
          disabled={pending || !selectedPlayer || !selectedParticipant}
          className="w-full rounded-lg bg-sky-600 px-4 py-3 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Recording…" : "Confirm Sale"}
        </button>
      </form>
    </div>
  );
}
