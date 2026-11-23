import Link from "next/link";

type ParticipantNavProps = {
  active: "active-auctions" | "archives" | "auction-history";
};

export function ParticipantNav({ active }: ParticipantNavProps) {
  const linkClass = (key: typeof active) =>
    [
      "inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active === key
        ? "bg-sky-600 text-white"
        : "text-slate-700 hover:bg-sky-50 hover:text-sky-900",
    ].join(" ");

  return (
    <nav
      aria-label="Participant"
      className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4"
    >
      <Link href="/dashboard" className={linkClass("active-auctions")}>
        Active Auctions
      </Link>
      <Link href="/archives" className={linkClass("archives")}>
        Archives
      </Link>
      <Link href="/auction-history" className={linkClass("auction-history")}>
        Auction History
      </Link>
      <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:inline-block" aria-hidden />
      <Link
        href="/rules"
        className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 underline-offset-2 hover:text-sky-800 hover:underline"
      >
        Rules
      </Link>
      {/* Public HFW Stats dashboard (static page, opens outside the app shell). */}
      <a
        href="/stats"
        className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition-colors hover:border-sky-400 hover:bg-sky-100"
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10m6 10V4m6 16v-7m4 7H2" />
        </svg>
        Stats
      </a>
    </nav>
  );
}
