import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Match scores · HFW",
  description: "Player points for World Cup 2026 matches.",
};

export default function ScoresLayout({ children }: { children: React.ReactNode }) {
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
          Official scoring for each completed match. No login required.
        </p>
      </header>
      {children}
    </div>
  );
}
