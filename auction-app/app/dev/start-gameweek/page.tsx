import Link from "next/link";
import { notFound } from "next/navigation";

import {
  loadStartGameweekPreview,
  MIN_FUTURE_ROUNDS,
  MIN_LEAD_HOURS,
  type StartGameweekOutcome,
} from "@/lib/auction-state/start-gameweek";

/**
 * TEMPORARY dev-only page (HFW Self-Sufficiency step 2): shows which gameweek a new
 * auction would start at, for the real time or a simulated one. Removed once the
 * auction lobby uses the same logic. Never rendered in production.
 */
export const dynamic = "force-dynamic";

const UCL_2026_27_COMPETITION_ID = 4;

const PRESETS: { label: string; iso: string | null }[] = [
  { label: "Real now", iso: null },
  { label: "8 Oct 14:14 — last minute for MW2", iso: "2026-10-08T13:14:00Z" },
  { label: "9 Oct noon", iso: "2026-10-09T11:00:00Z" },
  { label: "15 Oct 14:14 — last minute for MW3", iso: "2026-10-15T13:14:00Z" },
  { label: "15 Oct 14:16 — just missed MW3", iso: "2026-10-15T13:16:00Z" },
  { label: "29 Oct 14:14 — last minute for MW4", iso: "2026-10-29T14:14:00Z" },
  { label: "29 Oct 14:16 — just missed MW4", iso: "2026-10-29T14:16:00Z" },
  { label: "4 Nov — only MW5 recorded ahead", iso: "2026-11-04T12:00:00Z" },
  { label: "25 Nov — nothing recorded ahead", iso: "2026-11-25T12:00:00Z" },
];

const irish = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Dublin",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

function duration(hours: number): string {
  const total = Math.max(0, Math.floor(hours * 60));
  const d = Math.floor(total / (24 * 60));
  const h = Math.floor((total % (24 * 60)) / 60);
  const m = total % 60;
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

function OutcomeCard({ title, outcome }: { title: string; outcome: StartGameweekOutcome }) {
  if (!outcome.ok) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">{title}</p>
        <p className="mt-1 text-base font-semibold text-red-900">Blocked — {outcome.reason}</p>
        <p className="mt-1 text-sm text-red-800">{outcome.message}</p>
        <p className="mt-2 text-xs text-red-700">Future gameweeks on record: {outcome.futureRoundCount}</p>
      </div>
    );
  }
  const t = outcome.target;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{title}</p>
      <p className="mt-1 text-base font-semibold text-emerald-900">
        First gameweek: {t.displayName} (GW id {t.legacyGameWeekId})
      </p>
      <ul className="mt-2 space-y-1 text-sm text-emerald-900">
        <li>
          Time to open new players: <strong>{duration(outcome.hoursUntilInitiation)}</strong> (initiation{" "}
          {irish(t.initiationDeadlineAt)})
        </li>
        <li>Hard deadline {irish(t.hardDeadlineAt)} · first kickoff {irish(t.firstKickoffAt)}</li>
        <li>
          Start before <strong>{irish(outcome.cutoffAt)}</strong> to keep {t.displayName}
        </li>
        {outcome.tooClose.length > 0 && (
          <li>
            Skipped as too close (&lt; {MIN_LEAD_HOURS}h):{" "}
            {outcome.tooClose
              .map((s) => `${s.round.displayName} (${duration(s.hoursUntilInitiation)} away)`)
              .join(", ")}
          </li>
        )}
      </ul>
    </div>
  );
}

export default async function StartGameweekDevPage({
  searchParams,
}: {
  searchParams: Promise<{ now?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { now: nowParam } = await searchParams;
  const parsed = nowParam ? Date.parse(nowParam) : NaN;
  const simulated = Number.isFinite(parsed);
  // Real time is taken inside the loader (keeps render pure).
  const preview = await loadStartGameweekPreview(UCL_2026_27_COMPETITION_ID, simulated ? parsed : undefined);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Dev only · temporary</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">New auction — first gameweek check</h1>
        <p className="mt-1 text-sm text-slate-700">
          UEFA CL 2026/27 · rule: first gameweek = earliest recorded round with ≥ {MIN_LEAD_HOURS}h to its
          initiation deadline; blocked unless ≥ {MIN_FUTURE_ROUNDS} future rounds are recorded. All times Irish.
        </p>
      </header>

      <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-700">
          {simulated ? "Simulated" : "Real"} time: <strong>{irish(preview.now)}</strong>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const active = p.iso ? nowParam === p.iso : !simulated;
            return (
              <Link
                key={p.label}
                href={p.iso ? `/dev/start-gameweek?now=${encodeURIComponent(p.iso)}` : "/dev/start-gameweek"}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  active ? "border-sky-600 bg-sky-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-sky-50"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
        <form className="mt-3 flex gap-2" action="/dev/start-gameweek">
          <input
            name="now"
            defaultValue={nowParam ?? ""}
            placeholder="ISO time, e.g. 2026-10-15T14:00:00+01:00"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 font-mono text-sm"
          />
          <button className="rounded-lg bg-sky-600 px-3 py-1 text-sm font-semibold text-white">Check</button>
        </form>
      </section>

      <OutcomeCard title="If bidding starts now" outcome={preview.outcome} />
      {preview.ifStartedAfterCutoff && (
        <OutcomeCard title="If bidding starts just after the cutoff" outcome={preview.ifStartedAfterCutoff} />
      )}

      <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Recorded schedule ({preview.rounds.length} rounds)</h2>
        <table className="mt-2 w-full text-left text-xs text-slate-700">
          <thead>
            <tr className="text-slate-500">
              <th className="py-1">Round</th>
              <th>Initiation</th>
              <th>Raise</th>
              <th>Hard</th>
              <th>Kickoff</th>
            </tr>
          </thead>
          <tbody>
            {preview.rounds.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-1 font-medium">{r.displayName}</td>
                <td>{irish(r.initiationDeadlineAt)}</td>
                <td>{irish(r.raiseDeadlineAt)}</td>
                <td>{irish(r.hardDeadlineAt)}</td>
                <td>{irish(r.firstKickoffAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
