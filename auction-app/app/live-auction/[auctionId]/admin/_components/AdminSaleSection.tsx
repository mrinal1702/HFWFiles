"use client";

import { useState } from "react";

import type {
  LiveAuctionPlayer,
  LiveAuctionParticipant,
  PlayerWithSaleInfo,
  RecordSaleState,
  EditSaleState,
} from "@/lib/live-auction-types";
import { SaleForm } from "./SaleForm";
import { TeamBrowseForm } from "./TeamBrowseForm";

type Mode = "search" | "browse";

type Props = {
  availablePlayers: LiveAuctionPlayer[];
  allPlayers: PlayerWithSaleInfo[];
  participants: LiveAuctionParticipant[];
  recordSale: (prevState: RecordSaleState, formData: FormData) => Promise<RecordSaleState>;
  editSale: (prevState: EditSaleState, formData: FormData) => Promise<EditSaleState>;
};

export function AdminSaleSection({
  availablePlayers,
  allPlayers,
  participants,
  recordSale,
  editSale,
}: Props) {
  const [mode, setMode] = useState<Mode>("search");

  const modes: Array<{ id: Mode; label: string }> = [
    { id: "search", label: "Search player" },
    { id: "browse", label: "Browse by team" },
  ];

  return (
    <div>
      {/* Mode toggle */}
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === m.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "search" ? (
        availablePlayers.length === 0 ? (
          <p className="text-sm text-slate-500">
            No players available — all have been sold or marked as unsold.
          </p>
        ) : (
          <SaleForm
            players={availablePlayers}
            participants={participants}
            recordSale={recordSale}
          />
        )
      ) : (
        <TeamBrowseForm
          allPlayers={allPlayers}
          participants={participants}
          recordSale={recordSale}
          editSale={editSale}
        />
      )}
    </div>
  );
}
