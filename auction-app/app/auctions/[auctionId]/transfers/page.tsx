import Link from "next/link";

import { TransferCard } from "@/app/auctions/[auctionId]/transfers/_components/TransferCard";
import { LocalTime } from "@/app/auctions/_components/LocalTime";
import { getAuthUser } from "@/lib/auth/get-user";
import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";
import { createAdminClient } from "@/lib/supabase-server";
import { transferStatusColor, transferStatusLabel } from "@/lib/transfer-messages";
import { resolveAuctionCompetitionId } from "@/lib/players-query";
import { loadTransfersForAuction, voidExpiredTransfers } from "@/lib/transfers";

export const dynamic = "force-dynamic";

export default async function TransfersPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);

  const d = await loadAuctionDashboardForViewer(auctionId);
  const user = await getAuthUser();
  const isAdmin = !!(user?.email && process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL);

  if (!d.me) {
    return (
      <section className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-sm text-slate-600">
          You need to be a participant in this auction to view transfers.
        </p>
      </section>
    );
  }

  if (d.me.is_relegated) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm sm:p-8">
        <h2 className="text-base font-semibold text-red-950">Relegated — view only</h2>
        <p className="mt-2 text-sm leading-relaxed text-red-900">
          You were relegated after the standings cut. You can still view transfer history on this
          page when the window is open, but you cannot propose, respond to, or confirm transfers.
        </p>
      </section>
    );
  }

  const admin = createAdminClient();

  // Load window state and deadline
  const { data: auctionRow } = await admin
    .from("Auctions")
    .select("transfer_window_open, hard_deadline_at, transfers_require_admin_approval")
    .eq("id", auctionId)
    .maybeSingle();

  const transferWindowOpen =
    (auctionRow as { transfer_window_open?: boolean } | null)?.transfer_window_open ?? false;
  const pastHard = d.auction?.hard_deadline_at
    ? Date.now() >= Date.parse(d.auction.hard_deadline_at)
    : false;
  const windowClosed = !transferWindowOpen || pastHard;

  // Void expired transfers and close the window when hard deadline is passed
  if (pastHard) {
    await voidExpiredTransfers(admin, { auctionId }).catch(() => null);
  }

  // Window closed: show nothing else
  if (windowClosed) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mx-auto max-w-sm text-center">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <svg
              className="h-5 w-5 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-slate-900">Transfer Window Closed</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            The transfer window is not currently open. Check back when the commissioner opens it
            for the next round.
          </p>
        </div>
      </section>
    );
  }

  const { active, history } = await loadTransfersForAuction(
    admin,
    auctionId,
    resolveAuctionCompetitionId(d.auction),
  );
  const meId = d.me.id;

  // Only show transfers the current user is involved in (admins see all)
  const visibleActive = isAdmin
    ? active
    : active.filter((t) => t.proposer_id === meId || t.recipient_id === meId);
  const visibleHistory = isAdmin
    ? history
    : history.filter((t) => t.proposer_id === meId || t.recipient_id === meId);

  // Partition active transfers by whether the current user needs to act
  const myTurn = visibleActive.filter((t) => {
    if (t.status === "awaiting_response") return t.recipient_id === meId;
    if (t.status === "awaiting_confirmation") {
      if (t.proposer_id === meId) return !t.proposer_confirmed;
      if (t.recipient_id === meId) return !t.recipient_confirmed;
    }
    if (t.status === "pending_admin") return isAdmin;
    return false;
  });

  const theirTurn = visibleActive.filter((t) => !myTurn.includes(t));

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Transfer Room</h2>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              Window open
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Agree terms on WhatsApp, then formalise the deal here.
          </p>
        </div>
        <Link
          href={`/auctions/${auctionId}/transfers/new`}
          className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Propose a deal
        </Link>
      </div>

      {/* Needs your action */}
      {myTurn.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-sky-700">
            Needs your action ({myTurn.length})
          </h3>
          {myTurn.map((t) => (
            <TransferCard
              key={t.id}
              transfer={t}
              meId={meId}
              isAdmin={isAdmin}
              auctionId={auctionId}
            />
          ))}
        </div>
      )}

      {/* Waiting on them */}
      {theirTurn.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Awaiting their response ({theirTurn.length})
          </h3>
          {theirTurn.map((t) => (
            <TransferCard
              key={t.id}
              transfer={t}
              meId={meId}
              isAdmin={isAdmin}
              auctionId={auctionId}
            />
          ))}
        </div>
      )}

      {/* Empty state for active */}
      {visibleActive.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm text-slate-500">No active transfers.</p>
          <p className="mt-1 text-sm text-slate-400">
            Use the button above once you&apos;ve agreed terms with another manager.
          </p>
        </div>
      )}

      {/* Transfer history */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Transfer history
        </h3>
        {visibleHistory.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm text-slate-500">No completed transfers yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {visibleHistory.map((t) => (
                <li key={t.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {t.summary ? (
                        <p className="text-sm text-slate-800">{t.summary}</p>
                      ) : (
                        <p className="text-sm text-slate-800">
                          <span className="font-medium">{t.proposer_name ?? "—"}</span>
                          {" ↔ "}
                          <span className="font-medium">{t.recipient_name ?? "—"}</span>
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-slate-400">
                        <LocalTime iso={t.completed_at ?? t.created_at} />
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${transferStatusColor(t.status)}`}
                    >
                      {transferStatusLabel(t.status)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
