import Image from "next/image";
import Link from "next/link";

export type TrophyCabinetEntry = {
  auctionId: number;
  auctionName: string;
  year: number;
};

type TrophyCabinetProps = {
  trophies: TrophyCabinetEntry[];
  /** Empty-state copy when the viewer has no 1st-place finishes. */
  emptyMessage: string;
};

/**
 * First-place wins only: large trophy image with auction name underneath.
 * Everyone gets the panel; non-champions see the empty message.
 */
export function TrophyCabinet({ trophies, emptyMessage }: TrophyCabinetProps) {
  if (trophies.length === 0) {
    return <p className="mt-4 text-sm leading-relaxed text-slate-600">{emptyMessage}</p>;
  }

  return (
    <ul className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
      {trophies.map((row) => (
        <li key={row.auctionId}>
          <Link
            href={`/leaderboard/${row.auctionId}`}
            className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-4 py-6 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50/40"
          >
            <Image
              src="/trophy-cabinet.png"
              alt="Championship trophy"
              width={640}
              height={640}
              className="h-auto w-full max-w-[14rem] sm:max-w-[16rem]"
              priority={trophies.length === 1}
            />
            <span className="mt-4 text-center text-base font-semibold text-slate-900">
              {row.auctionName}
            </span>
            <span className="mt-1 text-center text-xs text-slate-600">{row.year}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
