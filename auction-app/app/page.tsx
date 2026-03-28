import Link from "next/link";

import { getAuthUser } from "@/lib/auth/get-user";
import { supabase } from "../lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data, error } = await supabase.from("players").select("*").limit(5);
  const user = await getAuthUser();

  return (
    <main className="mx-auto max-w-3xl flex-1 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Fantasy Auction App</h1>
      <p className="mt-2 text-sm text-neutral-500">
        {user ? (
          <>
            Signed in — open your{" "}
            <Link href="/dashboard" className="text-neutral-300 underline hover:text-white">
              dashboard
            </Link>{" "}
            to join or enter auctions.
          </>
        ) : (
          <>
            <Link href="/login" className="text-neutral-300 underline hover:text-white">
              Log in
            </Link>{" "}
            or{" "}
            <Link href="/signup" className="text-neutral-300 underline hover:text-white">
              sign up
            </Link>{" "}
            to play. Public Supabase smoke test (anon) below.
          </>
        )}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {user ? (
          <Link
            href="/dashboard"
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
          >
            Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
            >
              Sign up
            </Link>
          </>
        )}
        <Link
          href="/auction-lab"
          className="rounded-md border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
        >
          Auction lab (integration)
        </Link>
      </div>

      <pre className="mt-8 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 text-xs">
        {JSON.stringify({ data, error }, null, 2)}
      </pre>
    </main>
  );
}
