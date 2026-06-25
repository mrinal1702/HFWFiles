import { LocalTime } from "@/app/auctions/_components/LocalTime";
import type { EliminationRelease } from "@/lib/announcements";

export function EliminationReleasesFeed({
  releases,
}: {
  releases: EliminationRelease[];
}) {
  if (releases.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-500">
          No elimination releases yet. When nations are knocked out of the World Cup, managers
          who owned their players receive half their purchase price back here.
        </p>
      </div>
    );
  }

  const totalRefunded = releases.reduce((sum, r) => sum + r.refundAmount, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {releases.length} elimination {releases.length === 1 ? "release" : "releases"} ·{" "}
        <span className="font-mono font-medium text-rose-700">£{totalRefunded}m</span> returned
        across this auction
      </p>

      <ol className="space-y-3">
        {releases.map((r) => (
          <li key={`${r.playerId}:${r.timestamp}:${r.ownerName}`}>
            <EliminationReleaseCard release={r} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function EliminationReleaseCard({ release: r }: { release: EliminationRelease }) {
  return (
    <div className="flex gap-4 rounded-xl border border-rose-100 bg-rose-50 p-4 shadow-sm sm:p-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm">
        <EliminationIcon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">
          <span className="text-rose-700">{r.ownerName ?? "Unknown"}</span>
          {" — "}
          <span className="font-semibold text-slate-900">{r.playerName ?? r.playerId}</span>
          <span className="font-normal text-slate-600"> ({r.teamName} eliminated)</span>
          {" — "}
          <span className="font-normal text-slate-600">elimination release, </span>
          <span className="font-mono text-rose-700">£{r.refundAmount}m</span>
          <span className="font-normal text-slate-600"> received back</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {r.playerPosition && <>{r.playerPosition} · </>}
          originally bought for <span className="font-mono">£{r.purchasePrice}m</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          <LocalTime iso={r.timestamp} />
        </p>
      </div>
    </div>
  );
}

function EliminationIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
