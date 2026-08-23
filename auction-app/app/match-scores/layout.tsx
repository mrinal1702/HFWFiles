import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Match scores · HFW",
  description: "Player points for Premier League matches.",
};

export default function MatchScoresLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">
          How Football Works
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Match player points
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Official scoring for each completed match. Public page — no login required.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/" className="text-sky-700 underline hover:text-sky-900">
            ← Home
          </Link>
          <span className="mx-2 text-slate-300">·</span>
          <Link href="/dashboard" className="text-sky-700 underline hover:text-sky-900">
            Dashboard
          </Link>
        </p>
      </header>
      {children}
    </div>
  );
}
