import Link from "next/link";

import { LocalTime } from "@/app/auctions/_components/LocalTime";
import { AdminToggle } from "@/app/auctions/[auctionId]/transfers/_components/AdminToggle";
import { TransferCard } from "@/app/auctions/[auctionId]/transfers/_components/TransferCard";
import { getAuthUser } from "@/lib/auth/get-user";
import { loadAuctionDashboardForViewer } from "@/lib/auction-dashboard";
import { createAdminClient } from "@/lib/supabase-server";
import { transferStatusColor, transferStatusLabel } from "@/lib/transfer-messages";
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

  // Void any transfers that should have been cancelled by the hard deadline
  const admin = createAdminClient();
  const pastHard = d.auction?.hard_deadline_at
    ? Date.now() >= Date.parse(d.auction.hard_deadline_at)
    : false;
  if (pastHard) {
    await voidExpiredTransfers(admin, { auctionId }).catch(() => null);
  }

  // Load auction setting for admin toggle
  const { data: auctionRow } = await admin
    .from("Auctions")
    .select("transfers_require_admin_approval")
    .eq("id", auctionId)
    .maybeSingle();

  const requireAdminApproval =
    (auctionRow as { transfers_require_admin_approval?: boolean } | null)
      ?.transfers_require_admin_approval ?? false;

  const { active, history } = await loadTransfersForAuction(admin, auctionId);

  // Partition active transfers: those pending admin approval shown separately
  const pendingAdmin = active.filter((t) => t.status === "pending_admin");
  const inProgress = active.filter((t) => t.status !== "pending_admin");

  const transferDeadlinePassed = pastHard;

  return (
    <section className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Transfers</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Negotiate deals on WhatsApp, then formalise them here. Both parties must confirm
              before a transfer executes.
            </p>
          </div>
          {!transferDeadlinePassed && (
            <Link
              href={`/auctions/${auctionId}/transfers/new`}
              className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Propose transfer
            </Link>
          )}
        </div>

        {transferDeadlinePassed && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            The transfer deadline has passed. No new transfers can be proposed.
          </div>
        )}

        {isAdmin && (
          <AdminToggle auctionId={auctionId} currentValue={requireAdminApproval} />
        )}
      </div>

      {/* Admin approval queue */}
      {isAdmin && pendingAdmin.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-violet-700">
            Pending admin approval ({pendingAdmin.length})
          </h3>
          {pendingAdmin.map((t) => (
            <TransferCard
              key={t.id}
              transfer={t}
              meId={d.me!.id}
              isAdmin={isAdmin}
              auctionId={auctionId}
            />
          ))}
        </div>
      )}

      {/* Non-admin view of pending admin transfers */}
      {!isAdmin && pendingAdmin.filter((t) => t.proposer_id === d.me!.id || t.recipient_id === d.me!.id).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-violet-700">
            Awaiting admin approval
          </h3>
          {pendingAdmin
            .filter((t) => t.proposer_id === d.me!.id || t.recipient_id === d.me!.id)
            .map((t) => (
              <TransferCard
                key={t.id}
                transfer={t}
                meId={d.me!.id}
                isAdmin={isAdmin}
                auctionId={auctionId}
              />
            ))}
        </div>
      )}

      {/* Active transfers */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Active transfers {inProgress.length > 0 ? `(${inProgress.length})` : ""}
        </h3>
        {inProgress.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm text-slate-500">No active transfers.</p>
            {!transferDeadlinePassed && (
              <p className="mt-1 text-sm text-slate-400">
                Propose one using the button above once you&apos;ve agreed terms with another manager.
              </p>
            )}
          </div>
        ) : (
          inProgress.map((t) => (
            <TransferCard
              key={t.id}
              transfer={t}
              meId={d.me!.id}
              isAdmin={isAdmin}
              auctionId={auctionId}
            />
          ))
        )}
      </div>

      {/* Transfer history */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Transfer history
        </h3>
        {history.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm text-slate-500">No completed transfers yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {history.map((t) => (
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
