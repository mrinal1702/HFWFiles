import Link from "next/link";

import { getAuthUser } from "@/lib/auth/get-user";
import { loadMyAuctionsForUser } from "@/lib/auction-dashboard";
import { signOutAction } from "@/app/auth/actions";

import { JoinAuctionForm } from "./JoinAuctionForm";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }

  const sp = await searchParams;

  let auctions: Awaited<ReturnType<typeof loadMyAuctionsForUser>> = [];
  let loadError: string | null = null;
  try {
    auctions = await loadMyAuctionsForUser(user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-lg flex-1 px-4 py-8 sm:max-w-3xl sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h1>
        <form action={signOutAction}>
          <button
            type="submit"
            className="min-h-10 text-sm text-slate-600 underline hover:text-slate-900"
          >
            Log out
          </button>
        </form>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Signed in as <span className="font-medium text-slate-900">{user.email}</span>
      </p>

      {sp.error === "not_member" && (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
          You aren&apos;t in that auction yet. Enter your join code below, or pick an auction you already
          belong to.
        </p>
      )}

      <section className="mt-10 rounded-xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Join an auction</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Your commissioner should have shared a short code (letters and numbers). Enter it here to join
          — you can join even if bidding has already started.
        </p>
        <div className="mt-5">
          <JoinAuctionForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Start a new auction</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Commissioners will be able to create leagues here in a future update.
        </p>
        <button
          type="button"
          disabled
          className="mt-4 min-h-12 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 sm:w-auto sm:px-6"
        >
          Create auction (coming soon)
        </button>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Your auctions</h2>
        {loadError && (
          <p className="mt-4 text-sm leading-relaxed text-red-700">
            Couldn&apos;t load your auctions. If you just set up the database, try refreshing the page.{" "}
            <span className="font-mono text-xs text-red-800">{loadError}</span>
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {auctions.map((a) => (
            <li key={a.id}>
              <Link
                href={`/auctions/${a.id}/bidding-room`}
                className="block min-h-[3.5rem] rounded-xl border border-sky-100 bg-white px-4 py-3 shadow-sm hover:border-sky-300 hover:bg-sky-50/50"
              >
                <span className="font-medium text-slate-900">{a.name ?? `Auction #${a.id}`}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                  Code: <span className="font-mono text-slate-800">{a.join_code ?? "—"}</span>
                  {a.is_active === false ? " · inactive" : ""}
                  {a.hard_deadline_at
                    ? ` · deadline ${new Date(a.hard_deadline_at).toLocaleString()} (local)`
                    : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {auctions.length === 0 && !loadError && (
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            You haven&apos;t joined any auction yet. Use a join code above when your commissioner shares one.
          </p>
        )}
      </section>

      <p className="mt-12 text-center text-sm sm:text-left">
        <Link href="/" className="text-slate-600 underline hover:text-slate-900">
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
