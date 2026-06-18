"use client";

import { useState } from "react";
import type { GwInfo, ParticipantGwSquad, GwSquadPlayer } from "@/lib/leaderboard-data";

// ─── Position helpers ─────────────────────────────────────────────────────────

type SectionId = "gk" | "def" | "mid" | "fwd" | "other";

const SECTION_ORDER: Array<{ id: SectionId; label: string }> = [
  { id: "gk", label: "Goalkeepers" },
  { id: "def", label: "Defenders" },
  { id: "mid", label: "Midfielders" },
  { id: "fwd", label: "Forwards" },
  { id: "other", label: "Other" },
];

function sectionForPosition(pos: string | null): SectionId {
  const p = (pos ?? "").trim().toLowerCase();
  if (p === "gk" || p.includes("goalkeeper")) return "gk";
  if (p.includes("defend")) return "def";
  if (p.includes("midfield")) return "mid";
  if (p.includes("forward")) return "fwd";
  return "other";
}

// ─── Column header ────────────────────────────────────────────────────────────

function SquadColumnHeader() {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
      <span>Player</span>
      <span className="w-10 text-right">Pts</span>
    </div>
  );
}

// ─── Player row ───────────────────────────────────────────────────────────────

function PlayerRow({ player }: { player: GwSquadPlayer }) {
  const hasScore = player.score !== null;
  const isBestXiKnown = player.isBestXi !== null;
  const inXI = player.isBestXi === true;

  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
        isBestXiKnown && !inXI ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <span className={`font-medium ${inXI ? "text-slate-900" : "text-slate-700"}`}>
          {player.playerName ?? "—"}
        </span>
        {inXI && (
          <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
            XI
          </span>
        )}
        <span className="ml-2 text-xs text-slate-400">
          {player.club ?? "—"} · £{player.purchasePrice}
        </span>
      </div>
      <span
        className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
          hasScore ? "text-slate-900" : "text-slate-300"
        }`}
      >
        {hasScore ? player.score : "—"}
      </span>
    </div>
  );
}

// ─── Squad display ────────────────────────────────────────────────────────────

function SquadDisplay({ players }: { players: GwSquadPlayer[] }) {
  const hasBestXiData = players.some((p) => p.isBestXi !== null);

  if (hasBestXiData) {
    const xi = players
      .filter((p) => p.isBestXi === true)
      .sort((a, b) => {
        const sa = SECTION_ORDER.findIndex((s) => s.id === sectionForPosition(a.position));
        const sb = SECTION_ORDER.findIndex((s) => s.id === sectionForPosition(b.position));
        return sa - sb;
      });
    const bench = players
      .filter((p) => p.isBestXi === false)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-sky-200 bg-sky-50/60">
          <div className="border-b border-sky-200 bg-sky-100 px-3 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-800">
              Starting XI ({xi.length})
            </span>
          </div>
          <SquadColumnHeader />
          <div className="divide-y divide-sky-100">
            {xi.map((p) => (
              <PlayerRow key={p.playerId} player={p} />
            ))}
          </div>
        </div>

        {bench.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bench ({bench.length})
              </span>
            </div>
            <SquadColumnHeader />
            <div className="divide-y divide-slate-100">
              {bench.map((p) => (
                <PlayerRow key={p.playerId} player={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // No Best XI data yet — group by position
  const grouped = SECTION_ORDER.map((section) => ({
    ...section,
    rows: players.filter((p) => sectionForPosition(p.position) === section.id),
  })).filter((s) => s.rows.length > 0);

  return (
    <div className="space-y-3">
      {grouped.map((group) => (
        <div
          key={group.id}
          className="overflow-hidden rounded-lg border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group.label} ({group.rows.length})
            </span>
          </div>
          <SquadColumnHeader />
          <div className="divide-y divide-slate-100">
            {group.rows.map((p) => (
              <PlayerRow key={p.playerId} player={p} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GameweekSquadViewProps {
  activeGw: GwInfo | null;
  squads: ParticipantGwSquad[] | null;
  /** True = locked snapshot; false = live auction_teams fallback */
  squadsAreLocked: boolean;
  myUserId: number | null;
}

export function GameweekSquadView({
  activeGw,
  squads,
  squadsAreLocked,
  myUserId,
}: GameweekSquadViewProps) {
  const defaultId =
    squads?.find((s) => s.userId === myUserId)?.userId ?? squads?.[0]?.userId ?? null;
  const [selectedUserId, setSelectedUserId] = useState<number | null>(defaultId);

  if (!squads) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-600">Squads lock at the hard deadline.</p>
        <p className="mt-1 text-xs text-slate-400">
          This panel will populate automatically once the gameweek deadline passes.
        </p>
      </div>
    );
  }

  const selected = squads.find((s) => s.userId === selectedUserId) ?? squads[0];
  const totalScore = selected.totalGwScore;
  const scoresUploaded = selected.players.some((p) => p.score !== null);

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
          {activeGw
            ? `${activeGw.name} — ${squadsAreLocked ? "Locked snapshot" : "Live squad"}`
            : squadsAreLocked
              ? "Locked snapshot"
              : "Live squad"}
        </span>
        {scoresUploaded ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            Match points live
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
            Scores not yet uploaded
          </span>
        )}
      </div>

      {/* Participant picker */}
      <div className="flex flex-wrap gap-2">
        {squads.map((s) => (
          <button
            key={s.userId}
            onClick={() => setSelectedUserId(s.userId)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              s.userId === selected.userId
                ? "border-sky-600 bg-sky-700 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {s.name}
            {s.userId === myUserId && s.userId !== selected.userId && (
              <span className="ml-1 text-xs text-slate-400">(you)</span>
            )}
          </button>
        ))}
      </div>

      {/* Score summary (only shown once scores are published) */}
      {totalScore !== null && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-600">
            {selected.name}&apos;s{activeGw ? ` ${activeGw.name}` : ""} Best XI score:{" "}
          </span>
          <span className="font-mono text-lg font-bold text-slate-900">{totalScore} pts</span>
          <p className="mt-1 text-xs text-slate-500">
            Only players in Starting XI count toward this total. Bench scores are shown for reference.
          </p>
        </div>
      )}

      {/* Squad */}
      {selected.players.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">No players in this squad yet.</p>
      ) : (
        <SquadDisplay players={selected.players} />
      )}
    </div>
  );
}
