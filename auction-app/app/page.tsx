import Link from "next/link";

import { getAuthUser } from "@/lib/auth/get-user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAuthUser();

  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        HFW Fantasy Auction
      </h1>
      <p className="mt-4 text-center text-sm leading-relaxed text-slate-600 sm:text-base">
        Join your league&apos;s draft, place bids, and build your team — all in one place.
      </p>

      {user ? (
        <div className="mt-12 flex flex-col items-stretch gap-3 sm:items-center">
          <p className="text-center text-sm text-slate-600">
            You&apos;re signed in. Head to your dashboard to join an auction or open one you&apos;re already
            in.
          </p>
          <Link
            href="/dashboard"
            className="min-h-12 w-full rounded-lg bg-sky-600 px-5 py-3 text-center text-base font-medium text-white hover:bg-sky-700 sm:max-w-xs"
          >
            Go to dashboard
          </Link>
        </div>
      ) : (
        <div className="mt-12 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm font-medium text-slate-800">First time here?</p>
            <p className="text-center text-xs text-slate-600">
              Create a free account with your email. You&apos;ll use it for every auction you join.
            </p>
            <Link
              href="/signup"
              className="min-h-12 w-full rounded-lg bg-sky-600 px-5 py-3 text-center text-base font-medium text-white hover:bg-sky-700"
            >
              Sign up
            </Link>
          </div>

          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-500">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-center text-sm font-medium text-slate-800">Welcome back</p>
            <p className="text-center text-xs text-slate-600">Log in with the email you used before.</p>
            <Link
              href="/login"
              className="min-h-12 w-full rounded-lg border-2 border-sky-300 bg-white px-5 py-3 text-center text-base font-medium text-sky-800 hover:bg-sky-50"
            >
              Log in
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
