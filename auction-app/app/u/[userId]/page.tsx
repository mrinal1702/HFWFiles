import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProfileAvatarZoom } from "@/app/_components/entity/ProfileAvatarZoom";
import { getAuthUser } from "@/lib/auth/get-user";
import { formatFinishLabel } from "@/lib/auction-history";
import { loadPublicProfile } from "@/lib/public-profile";

export const dynamic = "force-dynamic";

function safeReturnTo(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) {
    const { userId } = await params;
    redirect(`/login?next=${encodeURIComponent(`/u/${userId}`)}`);
  }

  const { userId } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const returnTo = safeReturnTo(sp?.returnTo);

  const profile = await loadPublicProfile(userId);
  if (!profile) {
    notFound();
  }

  const backHref = returnTo ?? "/dashboard";
  const backLabel = returnTo?.includes("/competitors")
    ? "← Back to auction"
    : returnTo?.startsWith("/auctions/")
      ? "← Back to auction"
      : "← Back";

  return (
    <main className="mx-auto max-w-lg flex-1 px-4 py-8 sm:max-w-2xl sm:px-6 sm:py-10">
      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex min-h-10 items-center text-sm font-medium text-sky-700 underline hover:text-sky-900"
        >
          {backLabel}
        </Link>
      </div>

      <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col items-center">
          <ProfileAvatarZoom name={profile.displayName} avatarUrl={profile.avatarUrl} />
          <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {profile.displayName}
          </h1>
          <p className="mt-1 text-center text-sm text-slate-600">HFW profile</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Past finishes</h2>
        <p className="mt-1 text-sm text-slate-600">
          Completed auctions only — same record as Auction History.
        </p>

        {profile.finishes.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No completed auctions on their record yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {profile.finishes.map((row) => (
              <li key={row.auctionId}>
                <Link
                  href={`/leaderboard/${row.auctionId}`}
                  className="block min-h-[3.5rem] rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-sky-300 hover:bg-sky-50/50"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-900">{row.auctionName}</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {formatFinishLabel(row.rank)}
                    </span>
                  </div>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                    {row.year}
                    {row.totalPoints > 0 ? ` · ${row.totalPoints} pts` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10">
        <Link
          href={backHref}
          className="text-sm font-medium text-sky-700 underline hover:text-sky-900"
        >
          {backLabel}
        </Link>
      </p>
    </main>
  );
}
