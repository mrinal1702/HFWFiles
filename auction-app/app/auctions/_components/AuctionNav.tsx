import Link from "next/link";

const links = (auctionId: number) =>
  [
    { href: `/auctions/${auctionId}/bidding-room`, label: "Bidding room" },
    { href: `/auctions/${auctionId}/team`, label: "My team" },
    { href: `/auctions/${auctionId}/bids-held`, label: "Bids held" },
    { href: `/auctions/${auctionId}/points`, label: "My points" },
    { href: `/auctions/${auctionId}/leaderboard`, label: "Leaderboard" },
    { href: `/auctions/${auctionId}/competitors`, label: "Competitors" },
  ] as const;

export function AuctionNav({ auctionId }: { auctionId: number }) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
      {links(auctionId).map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className="rounded-md px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
