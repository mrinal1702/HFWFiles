import Link from "next/link";
import Image from "next/image";

import { ParticipantNav } from "@/app/_components/ParticipantNav";
import { getAuthUser } from "@/lib/auth/get-user";
import { loadMyArchivedAuctionsForUser } from "@/lib/auction-dashboard";
import { signOutAction } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function ArchivesPage() {
  const user = await getAuthUser();
  if (!user) {
    return null;
  }

  let auctions: Awaited<ReturnType<typeof loadMyArchivedAuctionsForUser>> = [];
  let loadError: string | null = null;
  try {
    auctions = await loadMyArchivedAuctionsForUser(user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-lg flex-1 px-4 py-8 sm:max-w-3xl sm:px-6 sm:py-10">
      <div className="mb-6 flex justify-center sm:mb-8">
        <Image
          src="/hfw-auction-logo.png"
          alt="HFW Auction logo"
          width={768}
          height={768}
          className="h-auto w-full max-w-xs sm:max-w-sm"
        />
      </div>

      <ParticipantNav active="archives" />

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Archives</h1>
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
        Past auctions you took part in — standings, squads, and history stay available here.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Archived auctions</h2>
        {loadError && (
          <p className="mt-4 text-sm leading-relaxed text-red-700">
            Couldn&apos;t load archived auctions.{" "}
            <span className="font-mono text-xs text-red-800">{loadError}</span>
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {auctions.map((a) => (
            <li key={a.id}>
              <Link
                href={`/leaderboard/${a.id}`}
                className="block min-h-[3.5rem] rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-sky-300 hover:bg-sky-50/50"
              >
                <span className="font-medium text-slate-900">{a.name ?? `Auction #${a.id}`}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                  Archived · open standings &amp; history
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {auctions.length === 0 && !loadError && (
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            No archived auctions yet. When a tournament ends, it will show up here.
          </p>
        )}
      </section>

      <p className="mt-12 text-center text-sm sm:text-left">
        <Link href="/dashboard" className="text-slate-600 underline hover:text-slate-900">
          ← Back to Active Auctions
        </Link>
      </p>
    </main>
  );
}
