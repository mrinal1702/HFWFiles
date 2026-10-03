import Link from "next/link";

import { loadCompetitorsSummary } from "@/lib/auction-dashboard";
import { getAuthUser } from "@/lib/auth/get-user";

export const dynamic = "force-dynamic";

export default async function AdminCancelBidsParticipantsPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  const user = await getAuthUser();
  const rows = await loadCompetitorsSummary(auctionId, user?.id ?? null);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Cancel Bids</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Pick a participant to see the bids they&apos;re currently winning. Cancelling a bid returns the
          player to the unsold market and credits the money back to that participant.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm sm:p-5">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-600">No participants in this auction yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.user.id}>
                <Link
                  href={`/auction-admin/${auctionId}/cancel-bids/${r.user.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-sky-100 bg-white px-4 py-3 shadow-sm hover:bg-sky-50/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {r.user.name ?? `#${r.user.id}`}
                    </span>
                    {r.user.team_name && (
                      <span className="block truncate text-xs text-slate-500">{r.user.team_name}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right text-xs text-slate-600">
                    <span className="block font-mono text-sm tabular-nums text-slate-900">
                      {r.bidsHeldCount}
                    </span>
                    <span className="text-[11px] text-slate-500">bids held</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
