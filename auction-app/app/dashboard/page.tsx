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
  const adminEmail = process.env.ADMIN_EMAIL ?? "";

  let auctions: Awaited<ReturnType<typeof loadMyAuctionsForUser>> = [];
  let loadError: string | null = null;
  try {
    auctions = await loadMyAuctionsForUser(user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-3xl flex-1 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-neutral-400 underline hover:text-neutral-200"
          >
            Log out
          </button>
        </form>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Signed in as <span className="text-neutral-300">{user.email}</span>
      </p>

      {sp.error === "not_member" && (
        <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          You are not a member of that auction. Join with a code below, or pick one of your auctions.
        </p>
      )}

      <section className="mt-8 rounded-lg border border-neutral-800 bg-neutral-900/30 p-4">
        <h2 className="text-lg font-semibold">Join auction</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Enter the join code your commissioner shared (6–8 characters). You can join even after bidding
          has started.
        </p>
        <div className="mt-4">
          <JoinAuctionForm />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Create auction</h2>
        <p className="mt-2 text-sm text-neutral-500">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md border border-neutral-700 bg-neutral-900/50 px-4 py-2 text-sm text-neutral-500"
          >
            Create auction (coming soon)
          </button>
          {adminEmail ? (
            <span className="ml-2 text-xs text-neutral-600">
              Commissioner tools later; admin email configured for future use.
            </span>
          ) : null}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Your auctions</h2>
        {loadError && (
          <p className="mt-3 text-sm text-red-400">
            Could not load your auctions. If you just applied the auth SQL migration, restart the dev
            server. <span className="font-mono text-xs">{loadError}</span>
          </p>
        )}
        <ul className="mt-4 space-y-2">
          {auctions.map((a) => (
            <li key={a.id}>
              <Link
                href={`/auctions/${a.id}/bidding-room`}
                className="block rounded-lg border border-neutral-800 bg-neutral-900/30 px-4 py-3 hover:border-neutral-600"
              >
                <span className="font-medium text-neutral-100">{a.name ?? `Auction #${a.id}`}</span>
                <span className="mt-1 block text-xs text-neutral-500">
                  Code: <span className="font-mono text-neutral-400">{a.join_code ?? "—"}</span>
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
          <p className="mt-4 text-sm text-neutral-500">You have not joined any auction yet.</p>
        )}
      </section>

      <p className="mt-10 text-sm">
        <Link href="/" className="text-neutral-400 underline hover:text-neutral-200">
          ← Home
        </Link>
      </p>
    </main>
  );
}
