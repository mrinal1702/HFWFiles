import type { StandingEntry, GwInfo } from "@/lib/leaderboard-data";

interface StandingsTableProps {
  standings: StandingEntry[];
  gameWeeks: GwInfo[];
}

export function StandingsTable({ standings, gameWeeks }: StandingsTableProps) {
  if (standings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No participants in this auction yet.
      </p>
    );
  }

  const hasScores = gameWeeks.length > 0;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <thead className="border-b border-slate-200 bg-sky-50 text-slate-700">
          <tr>
            <th className="px-3 py-3 font-semibold">#</th>
            <th className="px-3 py-3 font-semibold">Manager</th>
            {gameWeeks.map((gw) => (
              <th key={gw.id} className="px-3 py-3 text-right font-semibold">
                {gw.name}
              </th>
            ))}
            <th className="px-3 py-3 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry, idx) => {
            const isTop = entry.rank === 1;
            return (
              <tr
                key={entry.userId}
                className={`border-b border-slate-100 ${
                  idx % 2 === 1 ? "bg-sky-50/40" : "bg-white"
                } ${isTop && hasScores ? "font-semibold" : ""}`}
              >
                <td className="px-3 py-3 tabular-nums text-slate-500">{entry.rank}</td>
                <td className="px-3 py-3 text-slate-900">{entry.name}</td>
                {gameWeeks.map((gw) => {
                  const score = entry.scoresByGwId[String(gw.id)];
                  return (
                    <td key={gw.id} className="px-3 py-3 text-right tabular-nums text-slate-700">
                      {score != null ? score : <span className="text-slate-300">—</span>}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                  {hasScores ? entry.total : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {!hasScores && (
        <p className="border-t border-slate-100 px-4 py-4 text-center text-sm text-slate-500">
          No gameweek scores have been published yet. Standings will update once the first
          gameweek is scored.
        </p>
      )}
    </div>
  );
}
