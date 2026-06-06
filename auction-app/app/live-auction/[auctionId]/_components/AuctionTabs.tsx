"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import type {
  LiveAuction,
  LiveAuctionParticipant,
  LiveAuctionPlayer,
  ParticipantSummaryWithPositions,
  SaleWithFullDetails,
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

const POSITION_COLORS: Record<PositionSection, string> = {
  gk: "bg-amber-500",
  def: "bg-blue-500",
  mid: "bg-emerald-500",
  fwd: "bg-red-500",
  other: "bg-slate-400",
};

function categorizePosition(position: string | null | undefined): PositionSection {
  const p = (position ?? "").trim().toLowerCase();
  if (p === "gk" || p.includes("goalkeeper")) return "gk";
  if (p.includes("defend")) return "def";
  if (p.includes("midfield")) return "mid";
  if (p.includes("forward") || p.includes("attack") || p.includes("striker")) return "fwd";
  return "other";
}

// ─── Shared UI atoms ─────────────────────────────────────────────────────────

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

/** Horizontal progress bar row used in spending breakdowns. */
function BreakdownBar({
  label,
  count,
  amount,
  totalBudget,
  color = "bg-sky-500",
}: {
  label: string;
  count: number;
  amount: number;
  totalBudget: number;
  color?: string;
}) {
  const pct = totalBudget > 0 ? Math.min(100, (amount / totalBudget) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-sm text-slate-700" title={label}>
        {label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-2 rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="w-32 shrink-0 text-right text-xs">
        <span className="font-mono font-semibold text-slate-900">£{amount}</span>
        <span className="ml-1 text-slate-400">({pct.toFixed(0)}%)</span>
        <span className="ml-1.5 text-slate-400">
          {count} {count === 1 ? "player" : "players"}
        </span>
      </div>
    </div>
  );
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = "my-team" | "all-teams" | "unsold" | "stats";

// ─── Root component ───────────────────────────────────────────────────────────

type Props = {
  auction: LiveAuction;
  auctionId: string;
  myParticipant: LiveAuctionParticipant | null;
  mySquad: SquadPlayer[];
  summaries: ParticipantSummaryWithPositions[];
  unsoldPlayers: LiveAuctionPlayer[];
  isAdmin: boolean;
  allSales: SaleWithFullDetails[];
};

export function AuctionTabs({
  auction,
  auctionId,
  myParticipant,
  mySquad,
  summaries,
  unsoldPlayers,
  isAdmin,
  allSales,
}: Props) {
  const router = useRouter();
  const isSpectator = !myParticipant;
  const [activeTab, setActiveTab] = useState<Tab>(isSpectator ? "all-teams" : "my-team");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1500);
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    ...(isSpectator ? [] : [{ id: "my-team" as const, label: "My Team" }]),
    { id: "all-teams", label: "All Teams" },
    { id: "unsold", label: `Unsold (${unsoldPlayers.length})` },
    { id: "stats", label: "Auction Stats" },
  ];

  return (
    <div className="space-y-5">
      {isSpectator && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Spectator view — refresh to see the latest sales. No login required.
        </p>
      )}
      {/* Tab bar + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
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
      {activeTab === "stats" && (
        <StatsTab allSales={allSales} summaries={summaries} auction={auction} />
      )}
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
                className={slotsLeft === 0 ? "font-medium text-green-700" : "text-slate-500"}
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
        <BudgetBar spent={totalSpent} total={auction.starting_budget} remaining={budgetRemaining} />
        {slotsLeft > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Avg per remaining slot:{" "}
            <span className="font-semibold text-slate-700">
              £{(budgetRemaining / slotsLeft).toFixed(2)}
            </span>
          </p>
        )}
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

      {/* Spending Analysis — only shown once there are players */}
      {mySquad.length > 0 && (
        <SpendingAnalysis
          mySquad={mySquad}
          startingBudget={auction.starting_budget}
        />
      )}
    </div>
  );
}

// ─── Spending Analysis ────────────────────────────────────────────────────────

function SpendingAnalysis({
  mySquad,
  startingBudget,
}: {
  mySquad: SquadPlayer[];
  startingBudget: number;
}) {
  // Team / club breakdown
  const teamMap: Record<string, { count: number; total: number }> = {};
  for (const player of mySquad) {
    const team = player.team_name ?? player.nation ?? "Unknown";
    if (!teamMap[team]) teamMap[team] = { count: 0, total: 0 };
    teamMap[team].count++;
    teamMap[team].total += player.price;
  }
  const teams = Object.entries(teamMap).sort((a, b) => b[1].total - a[1].total);

  // Position breakdown
  const posMap: Record<PositionSection, { count: number; total: number }> = {
    gk: { count: 0, total: 0 },
    def: { count: 0, total: 0 },
    mid: { count: 0, total: 0 },
    fwd: { count: 0, total: 0 },
    other: { count: 0, total: 0 },
  };
  for (const player of mySquad) {
    const cat = categorizePosition(player.position);
    posMap[cat].count++;
    posMap[cat].total += player.price;
  }
  const positions = SECTION_ORDER.filter((s) => posMap[s.id].count > 0);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Spending Analysis</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* By club */}
        <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
          <h4 className="mb-4 text-sm font-semibold text-slate-900">By Club</h4>
          <div className="space-y-3">
            {teams.map(([team, data]) => (
              <BreakdownBar
                key={team}
                label={team}
                count={data.count}
                amount={data.total}
                totalBudget={startingBudget}
              />
            ))}
          </div>
        </div>

        {/* By position */}
        <div className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
          <h4 className="mb-4 text-sm font-semibold text-slate-900">By Position</h4>
          <div className="space-y-3">
            {positions.map((section) => (
              <BreakdownBar
                key={section.id}
                label={section.label}
                count={posMap[section.id].count}
                amount={posMap[section.id].total}
                totalBudget={startingBudget}
                color={POSITION_COLORS[section.id]}
              />
            ))}
          </div>
        </div>
      </div>
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

        const slotsLeft = auction.squad_size - p.players_count;
        const avgPerSlot =
          slotsLeft > 0 ? (p.budget_remaining / slotsLeft).toFixed(2) : null;

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
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {positionParts.length > 0 ? (
                  positionParts.join(" · ")
                ) : (
                  <span className="italic text-slate-400">No players yet</span>
                )}
              </p>
              {avgPerSlot !== null && (
                <p className="shrink-0 text-xs text-slate-500">
                  avg/slot:{" "}
                  <span className="font-semibold text-slate-700">£{avgPerSlot}</span>
                </p>
              )}
            </div>
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

// ─── Auction Stats tab ────────────────────────────────────────────────────────

function StatsTab({
  allSales,
  summaries,
  auction,
}: {
  allSales: SaleWithFullDetails[];
  summaries: ParticipantSummaryWithPositions[];
  auction: LiveAuction;
}) {
  if (allSales.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm text-slate-500">No sales recorded yet — check back once the auction is underway.</p>
      </div>
    );
  }

  // ── Top 5 most expensive players (query already sorted price desc) ─────────
  const top5Players = allSales.slice(0, 5);

  // ── Top 5 teams/countries by total spend ──────────────────────────────────
  const teamSpendMap: Record<string, { total: number; count: number }> = {};
  for (const sale of allSales) {
    const team = sale.team_name ?? sale.nation ?? "Unknown";
    if (!teamSpendMap[team]) teamSpendMap[team] = { total: 0, count: 0 };
    teamSpendMap[team].total += sale.price;
    teamSpendMap[team].count++;
  }
  const top5Teams = Object.entries(teamSpendMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);
  const maxTeamSpend = top5Teams[0]?.[1]?.total ?? 1;

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalPlayersSold = allSales.length;
  const totalParticipants = summaries.length;

  const avgSpending =
    totalParticipants > 0
      ? summaries.reduce((sum, s) => sum + s.total_spent, 0) / totalParticipants
      : 0;
  const avgRemaining =
    totalParticipants > 0
      ? summaries.reduce((sum, s) => sum + s.budget_remaining, 0) / totalParticipants
      : 0;

  const maxRemaining = Math.max(...summaries.map((s) => s.budget_remaining));
  const minRemaining = Math.min(...summaries.map((s) => s.budget_remaining));
  const maxRemainingGroup = summaries.filter((s) => s.budget_remaining === maxRemaining);
  const minRemainingGroup = summaries.filter((s) => s.budget_remaining === minRemaining);

  const participantsWithPlayers = summaries.filter((s) => s.players_count > 0);
  const avgPerPlayer = (s: ParticipantSummaryWithPositions) =>
    s.players_count > 0 ? s.total_spent / s.players_count : 0;

  const maxAvg =
    participantsWithPlayers.length > 0
      ? Math.max(...participantsWithPlayers.map(avgPerPlayer))
      : null;
  const minAvg =
    participantsWithPlayers.length > 0
      ? Math.min(...participantsWithPlayers.map(avgPerPlayer))
      : null;
  const maxAvgGroup =
    maxAvg !== null
      ? participantsWithPlayers.filter((s) => avgPerPlayer(s) === maxAvg)
      : [];
  const minAvgGroup =
    minAvg !== null
      ? participantsWithPlayers.filter((s) => avgPerPlayer(s) === minAvg)
      : [];

  return (
    <div className="space-y-6">
      {/* ── Top 5 most expensive players ─────────────────────────────────── */}
      <section className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Top 5 Most Expensive Players</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-5 py-2.5 font-medium">#</th>
                <th className="px-5 py-2.5 font-medium">Player</th>
                <th className="px-5 py-2.5 font-medium">Position</th>
                <th className="px-5 py-2.5 font-medium">Country</th>
                <th className="px-5 py-2.5 font-medium">Bought by</th>
                <th className="px-5 py-2.5 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {top5Players.map((sale, i) => (
                <tr key={sale.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-5 py-3 text-xs font-bold text-slate-400">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{sale.player_name}</td>
                  <td className="px-5 py-3 text-slate-500">{sale.position ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {sale.nation ?? sale.team_name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-700">{sale.participant_name}</td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-slate-900">
                    £{sale.price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Top 5 teams by spend ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Top 5 Teams by Spend</h3>
        <div className="space-y-3">
          {top5Teams.map(([team, data], i) => (
            <div key={team} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right text-xs font-bold text-slate-400">
                {i + 1}
              </span>
              <span className="w-28 shrink-0 truncate text-sm text-slate-700" title={team}>
                {team}
              </span>
              <div className="min-w-0 flex-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-sky-500 transition-all"
                    style={{ width: `${(data.total / maxTeamSpend) * 100}%` }}
                  />
                </div>
              </div>
              <div className="w-36 shrink-0 text-right text-xs">
                <span className="font-mono font-semibold text-slate-900">£{data.total}</span>
                <span className="ml-1.5 text-slate-400">
                  {data.count} {data.count === 1 ? "player" : "players"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Summary statistics ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Summary Statistics</h3>
        <dl className="divide-y divide-slate-100 text-sm">
          <StatRow label="Total players sold" value={String(totalPlayersSold)} />

          <StatRow label="Avg spend per participant" value={`£${avgSpending.toFixed(0)}`} mono />
          <StatRow
            label="Avg budget remaining per participant"
            value={`£${avgRemaining.toFixed(0)}`}
            mono
          />

          <StatRowMulti
            label="Most budget remaining"
            entries={maxRemainingGroup.map((p) => ({
              name: p.display_name,
              value: `£${p.budget_remaining}`,
              note: `${p.players_count} ${p.players_count === 1 ? "player" : "players"}`,
            }))}
          />

          <StatRowMulti
            label="Least budget remaining"
            entries={minRemainingGroup.map((p) => ({
              name: p.display_name,
              value: `£${p.budget_remaining}`,
              note: `${p.players_count} ${p.players_count === 1 ? "player" : "players"}`,
            }))}
          />

          {maxAvgGroup.length > 0 && (
            <StatRowMulti
              label="Highest avg spend per player"
              entries={maxAvgGroup.map((p) => ({
                name: p.display_name,
                value: `£${avgPerPlayer(p).toFixed(0)}`,
                note: `${p.players_count} ${p.players_count === 1 ? "player" : "players"}`,
              }))}
            />
          )}

          {minAvgGroup.length > 0 && maxAvg !== minAvg && (
            <StatRowMulti
              label="Lowest avg spend per player"
              entries={minAvgGroup.map((p) => ({
                name: p.display_name,
                value: `£${avgPerPlayer(p).toFixed(0)}`,
                note: `${p.players_count} ${p.players_count === 1 ? "player" : "players"}`,
              }))}
            />
          )}
        </dl>
      </section>
    </div>
  );
}

// ─── Summary stat helpers ─────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-semibold text-slate-900 ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function StatRowMulti({
  label,
  entries,
}: {
  label: string;
  entries: Array<{ name: string; value: string; note: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right">
        {entries.map((e) => (
          <div key={e.name} className="leading-6">
            <span className="font-semibold text-slate-900">{e.name}</span>
            <span className="ml-2 font-mono font-semibold text-sky-700">{e.value}</span>
            <span className="ml-1.5 text-xs text-slate-400">({e.note})</span>
          </div>
        ))}
      </dd>
    </div>
  );
}
