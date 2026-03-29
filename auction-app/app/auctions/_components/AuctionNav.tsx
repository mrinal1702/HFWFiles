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
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-neutral-800 pb-3 [scrollbar-width:thin] sm:flex-wrap sm:gap-2"
      aria-label="Auction sections"
    >
      {links(auctionId).map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className="shrink-0 rounded-md px-3 py-2.5 text-sm leading-tight text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 sm:py-2"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
