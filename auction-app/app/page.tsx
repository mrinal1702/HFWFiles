import Link from "next/link";

import { getAuthUser } from "@/lib/auth/get-user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAuthUser();

  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
        HFW Fantasy Auction
      </h1>
      <p className="mt-4 text-center text-sm leading-relaxed text-neutral-400 sm:text-base">
        Join your league&apos;s draft, place bids, and build your team — all in one place.
      </p>

      {user ? (
        <div className="mt-12 flex flex-col items-stretch gap-3 sm:items-center">
          <p className="text-center text-sm text-neutral-500">
            You&apos;re signed in. Head to your dashboard to join an auction or open one you&apos;re already
            in.
          </p>
          <Link
            href="/dashboard"
            className="min-h-12 w-full rounded-lg bg-neutral-100 px-5 py-3 text-center text-base font-medium text-neutral-900 sm:max-w-xs"
          >
            Go to dashboard
          </Link>
        </div>
      ) : (
        <div className="mt-12 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm font-medium text-neutral-300">First time here?</p>
            <p className="text-center text-xs text-neutral-500">
              Create a free account with your email. You&apos;ll use it for every auction you join.
            </p>
            <Link
              href="/signup"
              className="min-h-12 w-full rounded-lg bg-neutral-100 px-5 py-3 text-center text-base font-medium text-neutral-900"
            >
              Sign up
            </Link>
          </div>

          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-800" />
            <span className="text-xs text-neutral-600">or</span>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-center text-sm font-medium text-neutral-300">Welcome back</p>
            <p className="text-center text-xs text-neutral-500">Log in with the email you used before.</p>
            <Link
              href="/login"
              className="min-h-12 w-full rounded-lg border border-neutral-600 px-5 py-3 text-center text-base font-medium text-neutral-100 hover:bg-neutral-800"
            >
              Log in
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
