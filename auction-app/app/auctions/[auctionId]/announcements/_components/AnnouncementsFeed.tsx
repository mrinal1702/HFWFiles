"use client";

import { useMemo, useState } from "react";

import { LocalTime } from "@/app/auctions/_components/LocalTime";
import type {
  Announcement,
  AnnouncementFilter,
  BuyAnnouncement,
  ReleaseAnnouncement,
  TransferAnnouncement,
} from "@/lib/announcements";
import type { PlayerMeta } from "@/lib/transfers";

const FILTERS: { id: AnnouncementFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "buy", label: "Buys" },
  { id: "transfer", label: "Transfers" },
  { id: "release", label: "Releases" },
];

export function AnnouncementsFeed({ announcements }: { announcements: Announcement[] }) {
  const [filter, setFilter] = useState<AnnouncementFilter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return announcements;
    return announcements.filter((a) => a.type === filter);
  }, [announcements, filter]);

  const counts = useMemo(() => {
    const buy = announcements.filter((a) => a.type === "buy").length;
    const transfer = announcements.filter((a) => a.type === "transfer").length;
    const release = announcements.filter((a) => a.type === "release").length;
    return { all: announcements.length, buy, transfer, release };
  }, [announcements]);

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter announcements by type"
      >
        {FILTERS.map(({ id, label }) => {
          const active = filter === id;
          const count = counts[id];
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(id)}
              className={
                active
                  ? "rounded-full bg-slate-800 px-3 py-1.5 text-sm font-medium text-white shadow-sm"
                  : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              }
            >
              {label}
              <span className="ml-1.5 tabular-nums text-xs opacity-80">({count})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-500">
            {announcements.length === 0
              ? "No announcements yet. Check back once bidding is underway."
              : `No ${filter === "all" ? "" : `${filter} `}announcements to show.`}
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {filtered.map((a) => (
            <li key={announcementKey(a)}>
              <AnnouncementCard announcement={a} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function announcementKey(a: Announcement): string {
  if (a.type === "buy") {
    return `buy:${a.playerId}:${a.timestamp}:${a.buyerName}:${a.price}`;
  }
  if (a.type === "release") {
    return `release:${a.playerId}:${a.timestamp}:${a.ownerName}`;
  }
  return `transfer:${a.timestamp}:${a.proposerName}:${a.recipientName}:${a.summary ?? ""}`;
}

function AnnouncementCard({ announcement: a }: { announcement: Announcement }) {
  if (a.type === "buy") return <BuyCard a={a} />;
  if (a.type === "release") return <ReleaseCard a={a} />;
  return <TransferCard a={a} />;
}

function BuyCard({ a }: { a: BuyAnnouncement }) {
  return (
    <div className="flex gap-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm sm:p-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
        <BuyIcon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">
          <span className="text-emerald-700">{a.buyerName ?? "Unknown"}</span>
          {" signed "}
          <span className="font-semibold text-slate-900">{a.playerName ?? a.playerId}</span>
          {" for "}
          <span className="font-mono text-emerald-700">£{a.price}m</span>
        </p>
        {a.playerPosition && (
          <p className="mt-0.5 text-xs text-slate-500">{a.playerPosition}</p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          <LocalTime iso={a.timestamp} />
        </p>
      </div>
    </div>
  );
}

function ReleaseCard({ a }: { a: ReleaseAnnouncement }) {
  const isPaid = a.releaseType === "paid";
  return (
    <div className="flex gap-4 rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm sm:p-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
        <ReleaseIcon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">
          <span className="text-amber-700">{a.ownerName ?? "Unknown"}</span>
          {" released "}
          <span className="font-semibold text-slate-900">{a.playerName ?? a.playerId}</span>
          {isPaid ? (
            <>
              {" — "}
              <span className="font-normal text-slate-600">paid release, </span>
              <span className="font-mono text-amber-700">£{a.refundAmount}m</span>
              <span className="font-normal text-slate-600"> received back</span>
            </>
          ) : (
            <span className="font-normal text-slate-600"> — free release</span>
          )}
        </p>
        {a.playerPosition && (
          <p className="mt-0.5 text-xs text-slate-500">
            {a.playerPosition}
            {" · "}
            originally bought for <span className="font-mono">£{a.purchasePrice}m</span>
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">
          <LocalTime iso={a.timestamp} />
        </p>
      </div>
    </div>
  );
}

function TransferCard({ a }: { a: TransferAnnouncement }) {
  const hasProposerPlayers = a.proposerPlayers.length > 0;
  const hasRecipientPlayers = a.recipientPlayers.length > 0;

  return (
    <div className="flex gap-4 rounded-xl border border-sky-100 bg-sky-50 p-4 shadow-sm sm:p-5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm">
        <TransferIcon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">Transfer completed</p>

        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TransferSide
            managerName={a.proposerName}
            players={a.proposerPlayers}
            cash={a.proposerCash}
          />
          <TransferSide
            managerName={a.recipientName}
            players={a.recipientPlayers}
            cash={a.recipientCash}
          />
        </div>

        {!hasProposerPlayers && !hasRecipientPlayers && a.summary && (
          <p className="mt-2 text-xs text-slate-600 italic">{a.summary}</p>
        )}

        <p className="mt-2 text-xs text-slate-400">
          <LocalTime iso={a.timestamp} />
        </p>
      </div>
    </div>
  );
}

function TransferSide({
  managerName,
  players,
  cash,
}: {
  managerName: string | null;
  players: PlayerMeta[];
  cash: number;
}) {
  const hasPlayers = players.length > 0;
  const hasCash = cash > 0;
  if (!hasPlayers && !hasCash) return null;

  return (
    <div className="rounded-lg border border-sky-200 bg-white/70 px-3 py-2.5">
      <p className="text-xs font-semibold text-sky-700">{managerName ?? "Unknown"} gave</p>
      <ul className="mt-1 space-y-0.5">
        {players.map((p) => (
          <li key={p.player_id} className="text-sm text-slate-800">
            {p.player_name ?? p.player_id}
            {p.position && (
              <span className="ml-1 text-xs text-slate-400">({p.position})</span>
            )}
          </li>
        ))}
        {hasCash && (
          <li className="font-mono text-sm font-medium text-sky-700">£{cash}m cash</li>
        )}
      </ul>
    </div>
  );
}

function BuyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 0 0-1.138-.432ZM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.5l-.746.051a1.14 1.14 0 0 0-.29.07.875.875 0 0 0-.312.143.814.814 0 0 0-.16.162.78.78 0 0 0-.1.25.863.863 0 0 0 .03.443c.051.16.145.295.241.406Z" />
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v.09a2.743 2.743 0 0 0-1.874 1.278 2.375 2.375 0 0 0-.264 1.557 2.414 2.414 0 0 0 .954 1.547c.456.35.988.586 1.509.737v2.202l-.265-.05a3.417 3.417 0 0 1-1.363-.64l-.06-.047a.75.75 0 0 0-.884 1.214c.056.04.115.083.176.122.492.318 1.086.538 1.72.657V15a.75.75 0 0 0 1.5 0v-.099a2.985 2.985 0 0 0 1.938-1.337 2.424 2.424 0 0 0 .244-1.522 2.44 2.44 0 0 0-.958-1.573 4.63 4.63 0 0 0-1.224-.653v-2.22l.042.01c.384.108.713.27.97.454a.75.75 0 0 0 .882-1.218 4.932 4.932 0 0 0-1.894-.881v-.089Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ReleaseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-1.068a.75.75 0 1 0-1.064-1.058l-2.5 2.5a.75.75 0 0 0 0 1.058l2.5 2.5a.75.75 0 1 0 1.064-1.058l-1.048-1.068h9.546A.75.75 0 0 0 19 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TransferIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M13.2 2.24a.75.75 0 0 0 .04 1.06l2.1 1.95H6.75a.75.75 0 0 0 0 1.5h8.59l-2.1 1.95a.75.75 0 1 0 1.02 1.1l3.5-3.25a.75.75 0 0 0 0-1.1l-3.5-3.25a.75.75 0 0 0-1.06.04Zm-6.4 8a.75.75 0 0 0-1.06-.04l-3.5 3.25a.75.75 0 0 0 0 1.1l3.5 3.25a.75.75 0 1 0 1.02-1.1l-2.1-1.95h8.59a.75.75 0 0 0 0-1.5H4.66l2.1-1.95a.75.75 0 0 0 .04-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
