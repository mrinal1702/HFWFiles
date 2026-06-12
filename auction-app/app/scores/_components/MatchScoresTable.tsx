import type { MatchScoreRow } from "@/lib/match-scores/types";

function formatScore(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function positionLabel(position: string): string {
  const p = position.toLowerCase();
  if (p === "goalkeeper") return "GK";
  if (p === "defender") return "DEF";
  if (p === "midfielder") return "MID";
  if (p === "forward") return "FWD";
  return position;
}

export function MatchScoresTable({ rows }: { rows: MatchScoreRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 w-10">#</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3 w-16">Pos</th>
              <th className="px-4 py-3 text-right">Stats</th>
              <th className="px-4 py-3 text-right">Endow.</th>
              <th className="px-4 py-3 text-right">Final</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isKeeper = row.position.toLowerCase() === "goalkeeper";
              const isNegative = row.finalScore < 0;
              return (
                <tr
                  key={`${row.playerId}-${idx}`}
                  className={`border-b border-slate-100 last:border-b-0 ${
                    isKeeper ? "bg-sky-50/60" : "hover:bg-slate-50/80"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.playerName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.teamName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                        isKeeper
                          ? "bg-sky-100 text-sky-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {positionLabel(row.position)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                    {formatScore(row.statsScore)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                    {formatScore(row.endowmentScore)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-base font-semibold tabular-nums ${
                      isNegative ? "text-rose-600" : "text-slate-900"
                    }`}
                  >
                    {formatScore(row.finalScore)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
