"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { FixturesModalButton } from "@/app/auctions/_components/FixturesModalButton";
import { getAuctionFixtures } from "@/lib/auction-fixtures";

const links = (auctionId: number) =>
  [
    { href: `/auctions/${auctionId}/bidding-room`, label: "Bidding room", match: "exact" as const },
    { href: `/auctions/${auctionId}/team`, label: "My team", match: "exact" as const },
    { href: `/auctions/${auctionId}/competitors`, label: "Competitors", match: "prefix" as const },
    { href: `/auctions/${auctionId}/bids-held`, label: "Bids held", match: "exact" as const },
    { href: `/auctions/${auctionId}/transfers`, label: "Transfer Room", match: "prefix" as const },
    { href: `/auctions/${auctionId}/match-scores`, label: "Match scores", match: "prefix" as const },
    { href: `/auctions/${auctionId}/leaderboard`, label: "Leaderboard", match: "prefix" as const },
  ] as const;

function isActive(pathname: string, href: string, match: "exact" | "prefix", auctionId: number) {
  if (href.endsWith("/bidding-room") && pathname.startsWith(`/auctions/${auctionId}/players/`)) {
    return true;
  }
  if (match === "prefix") return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href;
}

const navItemClass =
  "flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium leading-tight text-slate-700 hover:bg-sky-50 hover:text-sky-900";
const navItemActiveClass =
  "flex w-full items-center rounded-md bg-sky-600 px-3 py-2.5 text-left text-sm font-semibold leading-tight text-white shadow-sm";

export function AuctionSideNav({ auctionId }: { auctionId: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const fixtures = getAuctionFixtures(auctionId);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menuButton = (
    <button
      type="button"
      className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-sky-50 hover:text-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => setOpen(true)}
    >
      <span className="sr-only">Open auction menu</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
        <path
          fillRule="evenodd"
          d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );

  return (
    <>
      {/*
        Mobile: floating menu button only — do not reserve a left gutter (that made the
        bidding room feel narrow / zoomed-in). sm+: thin left rail as before.
      */}
      <div
        className="fixed left-2 top-[max(0.5rem,env(safe-area-inset-top))] z-30 rounded-lg border border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm sm:hidden"
        aria-label="Auction menu"
      >
        {menuButton}
      </div>
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-12 flex-col border-r border-slate-200 bg-white pt-[max(0.75rem,env(safe-area-inset-top))] sm:flex"
        aria-label="Auction menu rail"
      >
        <div className="mx-auto">{menuButton}</div>
      </aside>

      {/* Overlay drawer */}
      {open && (
        <div className="fixed inset-0 z-40" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close auction menu"
            onClick={() => setOpen(false)}
          />
          <nav
            id={panelId}
            className="absolute inset-y-0 left-0 flex w-[min(18rem,calc(100vw-2.5rem))] flex-col border-r border-slate-200 bg-white shadow-xl"
            aria-label="Auction sections"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
              <p className="text-sm font-semibold text-slate-900">Menu</p>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {links(auctionId).map(({ href, label, match }) => {
                const active = isActive(pathname, href, match, auctionId);
                const link = (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={active ? navItemActiveClass : navItemClass}
                    onClick={() => setOpen(false)}
                  >
                    {label}
                  </Link>
                );
                if (fixtures && href.endsWith("/bidding-room")) {
                  return (
                    <div key={href} className="contents">
                      {link}
                      <div onClick={() => setOpen(false)}>
                        <FixturesModalButton matchweeks={fixtures} className={navItemClass} />
                      </div>
                    </div>
                  );
                }
                return link;
              })}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
