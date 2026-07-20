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
        href="/match-scores"
        className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 underline-offset-2 hover:text-sky-800 hover:underline"
      >
        Match scores
      </Link>
    </nav>
  );
}
