import Link from "next/link";
import { redirect } from "next/navigation";

import { AuctionCard } from "@/app/_components/AuctionCard";
import { ParticipantNav } from "@/app/_components/ParticipantNav";
import { getAuthUser } from "@/lib/auth/get-user";
import { CREATE_AUCTION_COMPETITION } from "@/lib/auction-create";
import { loadStartGameweekPreview } from "@/lib/auction-state/start-gameweek";
import { loadMyActiveAuctionsForUser } from "@/lib/auction-state/auction-dashboard";
import { loadMyAdminAuctionsForUser } from "@/lib/online-auction-admin";
import { loadMyLiveAuctionsForDashboard } from "@/lib/live-auction-data";
import type { DashboardLiveAuctionRow } from "@/lib/live-auction-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/auth/actions";

import { JoinAuctionForm } from "./JoinAuctionForm";
import { ProfileAvatar } from "./ProfileAvatar";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const sp = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    (profile as { display_name?: string } | null)?.display_name?.trim() ||
    user.email?.split("@")[0] ||
    "Player";
  const avatarUrl = (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null;

  let auctions: Awaited<ReturnType<typeof loadMyActiveAuctionsForUser>> = [];
  let adminAuctions: Awaited<ReturnType<typeof loadMyAdminAuctionsForUser>> = [];
  let liveAuctions: DashboardLiveAuctionRow[] = [];
  let loadError: string | null = null;
  try {
    [auctions, adminAuctions, liveAuctions] = await Promise.all([
      loadMyActiveAuctionsForUser(user.id),
      loadMyAdminAuctionsForUser(user.id),
      loadMyLiveAuctionsForDashboard(user.id),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  // Create auction is offered only while enough upcoming gameweeks are on record.
  let createBlockedMessage: string | null = null;
  try {
    const { outcome } = await loadStartGameweekPreview(CREATE_AUCTION_COMPETITION.id);
    if (!outcome.ok) createBlockedMessage = outcome.message;
  } catch {
    createBlockedMessage = "Creating auctions is unavailable right now. Please try again later.";
  }

  return (
    <main className="mx-auto max-w-lg flex-1 px-4 py-8 sm:max-w-3xl sm:px-6 sm:py-10">
      <ProfileAvatar userId={user.id} displayName={displayName} avatarUrl={avatarUrl} />

      <ParticipantNav active="active-auctions" />

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Active Auctions
        </h2>
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

      {sp.error === "not_admin" && (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
          Admin access requires the admin code. Enter it under Join an auction below.
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Your auctions</h2>
        {loadError && (
          <p className="mt-4 text-sm leading-relaxed text-red-700">
            Couldn&apos;t load your auctions. If you just set up the database, try refreshing the page.{" "}
            <span className="font-mono text-xs text-red-800">{loadError}</span>
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {auctions.map((a) => (
            <li key={`online-${a.id}`}>
              <AuctionCard
                href={`/auctions/${a.id}/bidding-room`}
                tone="participant"
                title={a.name ?? `Auction #${a.id}`}
                chips={[
                  { label: "Code", value: a.join_code ?? "—", mono: true },
                  ...(a.is_active === false ? [{ value: "inactive" }] : []),
                  ...(a.hard_deadline_at
                    ? [{ label: "Deadline", value: `${new Date(a.hard_deadline_at).toLocaleString()} (local)` }]
                    : []),
                ]}
              />
            </li>
          ))}
          {adminAuctions.map((a) => (
            <li key={`admin-${a.id}`}>
              <AuctionCard
                href={`/auction-admin/${a.id}`}
                tone="admin"
                title={a.name ?? `Auction #${a.id}`}
                subtitle="Admin controls — manage squads, budgets, and bids"
              />
            </li>
          ))}
          {liveAuctions.map((a) => {
            const href =
              a.access === "admin"
                ? `/live-auction/${a.id}/admin`
                : `/live-auction/${a.id}`;
            const status =
              a.status === "live" ? "in progress" : a.status === "setup" ? "setting up" : a.status === "paused" ? "paused" : null;
            return (
              <li key={`live-${a.access}-${a.id}`}>
                <AuctionCard
                  href={href}
                  tone={a.access === "admin" ? "admin" : "participant"}
                  title={a.name}
                  chips={[{ value: "Live auction" }, ...(status ? [{ value: status }] : [])]}
                />
              </li>
            );
          })}
        </ul>
        {auctions.length === 0 && adminAuctions.length === 0 && liveAuctions.length === 0 && !loadError && (
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            No active auctions right now. Finished tournaments are in{" "}
            <Link href="/archives" className="font-medium text-sky-700 underline hover:text-sky-900">
              Archives
            </Link>
            . Join a new one with a code below when your commissioner shares one.
          </p>
        )}
      </section>

      <section className="relative mt-10 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-white to-sky-50 p-5 pl-6 shadow-sm sm:p-6 sm:pl-7">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-sky-400 to-sky-600" />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200"
          >
            <KeyIcon />
          </span>
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Join an auction</h2>
        </div>
        <div className="relative mt-5">
          <JoinAuctionForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Start a new auction</h2>
        {createBlockedMessage ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{createBlockedMessage}</p>
            <button
              type="button"
              disabled
              className="mt-4 min-h-12 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 sm:w-auto sm:px-6"
            >
              Create auction
            </button>
          </>
        ) : (
          <Link
            href="/create-auction"
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-sky-700 px-4 py-3 text-base font-medium text-white shadow-md shadow-sky-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-200 sm:w-auto sm:px-6"
          >
            Create auction
          </Link>
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

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7.5a3 3 0 1 1 0 .01M21 8a6 6 0 0 1-7.7 5.75L11 16H9v2H7v2H4v-3l6.25-6.25A6 6 0 1 1 21 8Z" />
    </svg>
  );
}
