"use client";

import Link from "next/link";

import { fantasyTeamLabel } from "@/lib/team-name";

import { Avatar } from "./Avatar";

type Props = {
  auctionId: number;
  auctionUserId: number | null | undefined;
  name?: string | null;
  teamName?: string | null;
  avatarUrl?: string | null;
  /** When true, label prefers fantasy team name (leaderboard). Default: participant name. */
  preferTeamLabel?: boolean;
  showAvatar?: boolean;
  className?: string;
  /** Extra classes on the text/link portion only. */
  labelClassName?: string;
  /** Override competitor-page href (e.g. include `?gw=`). */
  href?: string;
};

function resolveLabel(
  preferTeamLabel: boolean,
  name: string | null | undefined,
  teamName: string | null | undefined,
  auctionUserId: number | null | undefined,
): string {
  if (preferTeamLabel) return fantasyTeamLabel(teamName, name);
  const n = name?.trim();
  if (n) return n;
  if (auctionUserId != null) return `#${auctionUserId}`;
  return "—";
}

/**
 * Inline manager identity: optional avatar + link to in-auction competitor page.
 * When auctionUserId is missing, renders plain text (no link).
 */
export function ManagerChip({
  auctionId,
  auctionUserId,
  name,
  teamName,
  avatarUrl,
  preferTeamLabel = false,
  showAvatar = true,
  className = "",
  labelClassName = "",
  href,
}: Props) {
  const label = resolveLabel(preferTeamLabel, name, teamName, auctionUserId);
  const avatarName = name?.trim() || label;
  const linked = auctionUserId != null && Number.isFinite(auctionUserId);
  const rowClass = `inline-flex max-w-full items-center gap-1.5 ${className}${
    linked ? " text-sky-800 hover:text-sky-950" : ""
  }`;

  const content = (
    <>
      {showAvatar && <Avatar name={avatarName} avatarUrl={avatarUrl} size="xs" />}
      <span
        className={`min-w-0 truncate ${linked ? "underline-offset-2 hover:underline" : ""} ${labelClassName}`}
      >
        {label}
      </span>
    </>
  );

  if (!linked) {
    return <span className={rowClass}>{content}</span>;
  }

  return (
    <Link
      href={href ?? `/auctions/${auctionId}/competitors/${auctionUserId}`}
      prefetch={false}
      className={rowClass}
    >
      {content}
    </Link>
  );
}
