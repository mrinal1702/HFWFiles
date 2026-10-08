import { LocalTime } from "@/app/auctions/_components/LocalTime";
import { transferStatusColor, transferStatusLabel } from "@/lib/auction-state/transfer-messages";
import type { EnrichedTransfer, PlayerMeta } from "@/lib/auction-state/transfers";

/**
 * One past transfer, built from the stored player ids + cash on each side
 * (not the DB `summary` text, which can omit players).
 * The viewer's side comes first; admins viewing others' deals see proposer first.
 */
export function TransferHistoryCard({ transfer: t, meId }: { transfer: EnrichedTransfer; meId: number }) {
  const viewerIsRecipient = t.recipient_id === meId;
  const proposer = { name: t.proposer_name ?? "—", players: t.proposer_players, cash: t.proposer_cash };
  const recipient = { name: t.recipient_name ?? "—", players: t.recipient_players, cash: t.recipient_cash };
  const [first, second] = viewerIsRecipient ? [recipient, proposer] : [proposer, recipient];
  const completed = t.status === "completed";
  const involved = t.proposer_id === meId || t.recipient_id === meId;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 p-4 pl-5 shadow-sm sm:p-5 sm:pl-6">
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1.5 ${completed ? "bg-gradient-to-b from-sky-400 to-sky-600" : "bg-slate-300"}`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          <LocalTime iso={t.completed_at ?? t.created_at} />
        </p>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${transferStatusColor(t.status)}`}
        >
          {transferStatusLabel(t.status)}
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        <DealLeg
          from={first.name}
          to={second.name}
          players={first.players}
          cash={first.cash}
          verb={completed ? "sent" : "offered"}
          tone={involved ? "out" : "neutral"}
        />
        <DealLeg
          from={second.name}
          to={first.name}
          players={second.players}
          cash={second.cash}
          verb={completed ? "sent" : "offered"}
          tone={involved ? "in" : "neutral"}
        />
      </div>
    </article>
  );
}

const LEG_TONE = {
  out: { box: "border-slate-200 bg-white", arrow: "text-slate-400", stripe: "bg-slate-300" },
  in: { box: "border-emerald-200 bg-emerald-50/60", arrow: "text-emerald-500", stripe: "bg-emerald-400" },
  neutral: { box: "border-slate-200 bg-white", arrow: "text-sky-400", stripe: "bg-sky-300" },
} as const;

/** One direction of a deal: "From → To" with every player and any cash. Shared with TransferCard. */
export function DealLeg({
  from,
  to,
  players,
  cash,
  verb,
  tone,
  emptyText = "Nothing",
}: {
  from: string;
  to: string;
  players: PlayerMeta[];
  cash: number;
  verb: "sent" | "offered";
  tone: keyof typeof LEG_TONE;
  /** Shown when this side has no players and no cash (e.g. "Awaiting their offer"). */
  emptyText?: string;
}) {
  const t = LEG_TONE[tone];
  const empty = players.length === 0 && cash <= 0;
  return (
    <div className={`relative overflow-hidden rounded-xl border py-3 pl-4 pr-3 ${t.box}`}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${t.stripe}`} />
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-900">
        <span>{from}</span>
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 shrink-0 ${t.arrow}`}>
          <path
            fillRule="evenodd"
            d="M3 10a.75.75 0 0 1 .75-.75h10.64l-3.72-3.72a.75.75 0 1 1 1.06-1.06l5 5a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 1 1-1.06-1.06l3.72-3.72H3.75A.75.75 0 0 1 3 10Z"
            clipRule="evenodd"
          />
        </svg>
        <span>{to}</span>
        <span className="sr-only">{verb}</span>
      </p>
      {empty ? (
        <p className="mt-2 text-sm italic text-slate-400">{emptyText}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {players.map((p) => (
            <li
              key={p.player_id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-800"
            >
              <span className="font-medium">{p.player_name ?? `Player #${p.player_id}`}</span>
              {p.position && <span className="text-xs text-slate-500">{p.position}</span>}
            </li>
          ))}
          {cash > 0 && (
            <li className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-sm font-semibold tabular-nums text-amber-900">
              £{cash}m
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
