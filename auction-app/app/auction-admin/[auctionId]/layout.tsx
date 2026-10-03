import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getAuthUser } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase-server";
import { getAdminDisplayName, getAuctionAdminUserId } from "@/lib/online-auction-admin";
import { AdminSideNav } from "./_components/AdminSideNav";

export const dynamic = "force-dynamic";

export default async function AuctionAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId: raw } = await params;
  const auctionId = Number(raw);
  if (!Number.isFinite(auctionId) || auctionId <= 0) {
    notFound();
  }

  const user = await getAuthUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/auction-admin/${auctionId}`)}`);
  }

  // Admin gate: only the auth user stored on Auctions.admin_user_id may enter.
  const adminUserId = await getAuctionAdminUserId(auctionId);
  if (!adminUserId || adminUserId !== user.id) {
    redirect("/dashboard?error=not_admin");
  }

  const admin = createAdminClient();
  const { data: auctionRow } = await admin
    .from("Auctions")
    .select("id, name")
    .eq("id", auctionId)
    .maybeSingle();
  if (!auctionRow) {
    notFound();
  }

  const auctionName = (auctionRow as { name: string | null }).name ?? `Auction #${auctionId}`;
  const adminName = await getAdminDisplayName(user.id);

  return (
    <div className="flex min-h-0 flex-1">
      <AdminSideNav auctionId={auctionId} />
      <div className="mx-auto min-w-0 max-w-6xl flex-1 px-3 pb-4 pt-12 sm:px-6 sm:py-6 sm:pl-[calc(3rem+1.5rem)]">
        <header className="mb-5 space-y-2 sm:mb-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Admin</p>
              <h1 className="min-w-0 text-lg font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {auctionName}
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">
                Signed in as <span className="font-medium text-slate-800">{adminName}</span>
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
            >
              Dashboard
            </Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
