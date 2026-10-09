import { Avatar } from "@/app/_components/entity/Avatar";
import type { AuctionUserRow } from "@/lib/auction-types";

/** Who has joined a lobby auction (shared by the participant and admin lobby views). */
export function LobbyMembers({
  members,
  maxParticipants,
  highlightUserId,
}: {
  members: AuctionUserRow[];
  maxParticipants: number;
  /** Auth user id to tag as "You". */
  highlightUserId?: string | null;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white p-5 pl-6 shadow-sm sm:p-6 sm:pl-7">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-slate-900">Managers</h2>
        <span className="text-sm font-medium text-slate-600">
          {members.length} / {maxParticipants} joined
        </span>
      </div>
      {members.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Nobody has joined yet.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {members.map((m) => {
            const name = m.name?.trim() || `Manager #${m.id}`;
            const isYou = highlightUserId != null && m.user_id === highlightUserId;
            return (
              <li
                key={m.id}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
              >
                <Avatar name={name} avatarUrl={m.avatar_url} size="sm" />
                <span className="min-w-0 truncate font-display text-base text-slate-900">{name}</span>
                {isYou && (
                  <span className="ml-auto shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                    You
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
