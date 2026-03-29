"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = (auctionId: number) =>
  [
    { href: `/auctions/${auctionId}/bidding-room`, label: "Bidding room", match: "exact" as const },
    { href: `/auctions/${auctionId}/team`, label: "My team", match: "exact" as const },
    { href: `/auctions/${auctionId}/bids-held`, label: "Bids held", match: "exact" as const },
    { href: `/auctions/${auctionId}/points`, label: "My points", match: "exact" as const },
    { href: `/auctions/${auctionId}/leaderboard`, label: "Leaderboard", match: "exact" as const },
    { href: `/auctions/${auctionId}/competitors`, label: "Competitors", match: "prefix" as const },
  ] as const;

function isActive(pathname: string, href: string, match: "exact" | "prefix") {
  if (match === "prefix") return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href;
}

export function AuctionNav({ auctionId }: { auctionId: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 pb-3 [scrollbar-width:thin] sm:flex-wrap sm:gap-2"
      aria-label="Auction sections"
    >
      {links(auctionId).map(({ href, label, match }) => {
        const active = isActive(pathname, href, match);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "shrink-0 rounded-md bg-sky-600 px-3 py-2.5 text-sm font-semibold leading-tight text-white shadow-sm sm:py-2"
                : "shrink-0 rounded-md px-3 py-2.5 text-sm font-medium leading-tight text-slate-700 hover:bg-sky-50 hover:text-sky-900 sm:py-2"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
