"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import type {
  LiveAuction,
  LiveAuctionParticipant,
  LiveAuctionPlayer,
  ParticipantSummaryWithPositions,
  SquadPlayer,
} from "@/lib/live-auction-types";

// ─── Position helpers ──────────────────────────────────────────────────────────

type PositionSection = "gk" | "def" | "mid" | "fwd" | "other";

const SECTION_ORDER: Array<{ id: PositionSection; label: string }> = [
  { id: "gk", label: "Goalkeepers" },
  { id: "def", label: "Defenders" },
  { id: "mid", label: "Midfielders" },
  { id: "fwd", label: "Forwards" },
  { id: "other", label: "Other" },
];

function categorizePosition(position: string | null | undefined): PositionSection {
  const p = (position ?? "").trim().toLowerCase();
  if (p === "gk" || p.includes("goalkeeper")) return "gk";
  if (p.includes("defend")) return "def";
  if (p.includes("midfield")) return "mid";
  if (p.includes("forward") || p.includes("attack") || p.includes("striker")) return "fwd";
  return "other";
}

// ─── Budget bar ───────────────────────────────────────────────────────────────

function BudgetBar({
  spent,
  total,
  remaining,
}: {
  spent: number;
  total: number;
  remaining: number;
}) {
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  const low = remaining < 20;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-slate-500">
          Spent £{spent} of £{total}
        </span>
        <span className={`font-mono font-semibold ${low ? "text-red-700" : "text-slate-900"}`}>
          £{remaining} left
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full transition-all ${low ? "bg-red-500" : "bg-sky-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = "my-team" | "all-teams" | "unsold";

// ─── Root component ───────────────────────────────────────────────────────────

type Props = {
  auction: LiveAuction;
  auctionId: string;
  myParticipant: LiveAuctionParticipant | null;
  mySquad: SquadPlayer[];
  summaries: ParticipantSummaryWithPositions[];
  unsoldPlayers: LiveAuctionPlayer[];
  isAdmin: boolean;
};

export function AuctionTabs({
  auction,
  auctionId,
  myParticipant,
  mySquad,
  summaries,
  unsoldPlayers,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("my-team");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1500);
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "my-team", label: "My Team" },
    { id: "all-teams", label: "All Teams" },
    { id: "unsold", label: `Unsold (${unsoldPlayers.length})` },
  ];

  return (
    <div className="space-y-5">
      {/* Tab bar + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href={`/live-auction/${auctionId}/admin`}
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              Admin →
            </Link>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <span
              className={refreshing ? "inline-block animate-spin" : "inline-block"}
              aria-hidden
            >
              ↻
            </span>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "my-team" && (
        <MyTeamTab
          myParticipant={myParticipant}
          mySquad={mySquad}
          summaries={summaries}
          auction={auction}
        />
      )}
      {activeTab === "all-teams" && (
        <AllTeamsTab summaries={summaries} auction={auction} auctionId={auctionId} />
      )}
      {activeTab === "unsold" && <UnsoldTab unsoldPlayers={unsoldPlayers} />}
    </div>
  );
}

// ─── My Team tab ──────────────────────────────────────────────────────────────

function MyTeamTab({
  myParticipant,
  mySquad,
  summaries,
  auction,
}: {
  myParticipant: LiveAuctionParticipant | null;
  mySquad: SquadPlayer[];
  summaries: ParticipantSummaryWithPositions[];
  auction: LiveAuction;
}) {
  if (!myParticipant) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-600">You are not a participant in this auction.</p>
        <p className="mt-1 text-xs text-slate-400">Contact the auction admin to be added.</p>
      </div>
    );
  }

  const mySummary = summaries.find((s) => s.id === myParticipant.id);
  const totalSpent = mySummary?.total_spent ?? 0;
  const budgetRemaining = mySummary?.budget_remaining ?? auction.starting_budget;
  const slotsUsed = mySummary?.players_count ?? 0;
  const slotsLeft = auction.squad_size - slotsUsed;

  const grouped = SECTION_ORDER.map((section) => ({
    ...section,
    rows: mySquad
      .filter((p) => categorizePosition(p.position) === section.id)
      .sort((a, b) => b.price - a.price),
  })).filter((s) => s.rows.length > 0);

  return (
    <div className="space-y-4">
      {/* Budget summary card */}
      <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{myParticipant.display_name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {slotsUsed} player{slotsUsed !== 1 ? "s" : ""} signed ·{" "}
              <span
                className={
                  slotsLeft === 0 ? "font-medium text-green-700" : "text-slate-500"
                }
              >
                {slotsLeft} slot{slotsLeft !== 1 ? "s" : ""} remaining
              </span>
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Squad size: {auction.squad_size}</p>
            <p>Min bid: £{auction.min_bid}</p>
          </div>
        </div>
        <BudgetBar
          spent={totalSpent}
          total={auction.starting_budget}
          remaining={budgetRemaining}
        />
      </div>

      {/* Squad list */}
      {mySquad.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm text-slate-500">No players signed yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-sm">
          {grouped.map((group, groupIdx) => (
            <div key={group.id}>
              <div
                className={`border-b border-slate-100 bg-slate-50 px-5 py-2.5 ${
                  groupIdx > 0 ? "border-t border-slate-200" : ""
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.label} ({group.rows.length})
                </span>
              </div>
              {group.rows.map((player) => (
                <div
                  key={player.sale_id}
                  className="flex items-center justify-between border-b border-slate-100 px-5 py-3 last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{player.player_name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[player.team_name ?? player.nation, player.position]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="ml-4 shrink-0 font-mono text-sm font-semibold text-slate-900">
                    £{player.price}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── All Teams tab ────────────────────────────────────────────────────────────

function AllTeamsTab({
  summaries,
  auction,
  auctionId,
}: {
  summaries: ParticipantSummaryWithPositions[];
  auction: LiveAuction;
  auctionId: string;
}) {
  if (summaries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-500">No participants yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {summaries.map((p) => {
        const pos = p.positions;
        const positionParts: string[] = [];
        if (pos.gk > 0) positionParts.push(`${pos.gk} GK`);
        if (pos.def > 0) positionParts.push(`${pos.def} DEF`);
        if (pos.mid > 0) positionParts.push(`${pos.mid} MID`);
        if (pos.fwd > 0) positionParts.push(`${pos.fwd} FWD`);
        if (pos.other > 0) positionParts.push(`${pos.other} other`);

        return (
          <Link
            key={p.id}
            href={`/live-auction/${auctionId}/team/${p.id}`}
            className="block rounded-xl border border-sky-100 bg-white p-5 shadow-sm transition-all hover:border-sky-300 hover:shadow-md"
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <span className="font-semibold text-slate-900">{p.display_name}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {p.players_count} / {auction.squad_size} players
              </span>
            </div>
            <BudgetBar
              spent={p.total_spent}
              total={auction.starting_budget}
              remaining={p.budget_remaining}
            />
            <p className="mt-3 text-xs text-slate-500">
              {positionParts.length > 0 ? positionParts.join(" · ") : (
                <span className="italic text-slate-400">No players yet</span>
              )}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Unsold Players tab ───────────────────────────────────────────────────────

function UnsoldTab({ unsoldPlayers }: { unsoldPlayers: LiveAuctionPlayer[] }) {
  if (unsoldPlayers.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-500">All players have been sold or the pool is empty.</p>
      </div>
    );
  }

  // Group by team name, sorted alphabetically
  const teamMap: Record<string, LiveAuctionPlayer[]> = {};
  for (const player of unsoldPlayers) {
    const team = player.team_name ?? player.nation ?? "Unknown";
    if (!teamMap[team]) teamMap[team] = [];
    teamMap[team].push(player);
  }
  const teams = Object.keys(teamMap).sort();

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {unsoldPlayers.length} player{unsoldPlayers.length !== 1 ? "s" : ""} not yet sold ·{" "}
        {teams.length} team{teams.length !== 1 ? "s" : ""}
      </p>
      {teams.map((team) => (
        <div
          key={team}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {team} ({teamMap[team].length})
            </span>
          </div>
          <div>
            {teamMap[team].map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5 last:border-b-0"
              >
                <span className="text-sm text-slate-900">{player.player_name}</span>
                <span className="ml-4 shrink-0 text-xs text-slate-400">
                  {player.position ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
